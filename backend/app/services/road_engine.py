"""
Road Engine - 百家乐路牌计算引擎

提供标准澳门路牌算法实现：
- 大路 (Big Road)
- 珠盘路 (Bead Road)  
- 大眼仔路 (Big Eye Road)
- 小路 (Small Road)
- 螳螂路 (Cockroach Road)
"""

from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RoadType(str, Enum):
    """路牌类型"""
    BIG_ROAD = "big_road"
    BEAD_ROAD = "bead_road"
    BIG_EYE = "big_eye"
    SMALL_ROAD = "small_road"
    COCKROACH_ROAD = "cockroach_road"


@dataclass
class RoadPoint:
    """路牌点数据"""
    game_number: int
    column: int  # 列索引 (0-based)
    row: int     # 行索引 (0-based, 0=最上面)
    value: str   # "庄", "闲", "和"
    is_new_column: bool = False
    error_id: Optional[int] = None
    is_tie: bool = False
    has_tie: bool = False  # 该点是否有和局标记


@dataclass
class RoadData:
    """路牌数据容器"""
    road_type: str
    display_name: str
    points: List[RoadPoint] = field(default_factory=list)
    max_columns: int = 0
    max_rows: int = 0


class RoadEngine:
    """
    百家乐路牌计算引擎 - 标准澳门规则
    
    核心规则：
    1. 大路：相同结果往下排，不同结果换新列，每列最多6个，超过拐弯
    2. 下三路：基于大路的衍生路，红=规律延续，蓝=规律转折
    """
    
    # 路牌配置
    MAX_ROWS_PER_COLUMN = 6  # 每列最大行数
    BEAD_ROAD_COLS = 14      # 珠盘路列数
    BEAD_ROAD_ROWS = 6       # 珠盘路行数
    
    def __init__(self, error_map: Optional[Dict[int, int]] = None):
        """
        初始化路牌引擎
        
        Args:
            error_map: 局号到错误ID的映射，用于标记错误局
        """
        self.error_map = error_map or {}

    # ========== 兼容API方法（用于stats.py等） ==========
    
    def set_error_marks(self, error_map: Dict[int, int]):
        """设置错误标记映射（兼容旧API）"""
        self.error_map = error_map
    
    def process_game(self, game_number: int, result: str):
        """处理单局游戏（兼容旧API，实际在calculate_all_roads中批量处理）"""
        if not hasattr(self, '_entries'):
            self._entries: List[Tuple[int, str]] = []
        self._entries.append((game_number, result))
    
    def calculate_all_roads(self, entries: Optional[List[Tuple[int, str]]] = None) -> Dict[str, RoadData]:
        """
        计算所有路牌
        
        Args:
            entries: 可选的局数据，如果不提供则使用process_game累积的数据
        
        Returns:
            Dict[str, RoadData]: 所有路牌数据
        """
        # 优先使用传入的entries，否则使用累积的_entries
        if entries is None:
            entries = getattr(self, '_entries', [])
        
        if not entries:
            return {
                "big_road": RoadData(road_type="big_road", display_name="大路"),
                "bead_road": RoadData(road_type="bead_road", display_name="珠盘路"),
                "big_eye": RoadData(road_type="big_eye", display_name="大眼仔路"),
                "small_road": RoadData(road_type="small_road", display_name="小路"),
                "cockroach_road": RoadData(road_type="cockroach_road", display_name="螳螂路"),
            }
        
        # 计算大路（基础路）
        big_road = self._calculate_big_road(entries)
        
        # 计算珠盘路
        bead_road = self._calculate_bead_road(entries)
        
        # 计算下三路（基于大路）
        big_eye = self._calculate_big_eye_road(big_road)
        small_road = self._calculate_small_road(big_road)
        cockroach_road = self._calculate_cockroach_road(big_road)
        
        return {
            "big_road": big_road,
            "bead_road": bead_road,
            "big_eye": big_eye,
            "small_road": small_road,
            "cockroach_road": cockroach_road,
        }
    
    def _calculate_big_road(self, all_entries: List[Tuple[int, str]]) -> RoadData:
        """
        大路算法 — 标准澳门规则（长龙拐弯修正版）
        
        核心规则：
        1. 相同结果往下排（纵向延伸）
        2. 不同结果换新列（从下一列开始，跳过被占用的行）
        3. 每列最多 MAX_ROWS_PER_COLUMN(6) 行
        4. 长龙拐弯规则：
           - 当一列超过6个时，第7个开始向右拐弯（保持在第5行，列+1）
           - 拐弯后的点仍属于同一长龙
           - 下一列的对应行被前一列的长龙拐弯占用
        5. 颜色变化时，从第0行开始，跳过被占用的行
        
        示例（用户确认的正确显示）：
        第1-6局庄 → 第1列行0-5
        第7局庄 → 第2列行5（拐弯）
        第8局庄 → 第3列行5（拐弯）
        第9-13局闲 → 第2列行0-4（跳过被占用的行5）
        第14局闲 → 第3列行4（拐弯，跳过行5）
        第15-17局庄 → 第3列行0-2（跳过被占用的行4和行5）
        
        最终显示：
        第1列: 庄1-6 (行0-5)
        第2列: 闲9-13 (行0-4), 庄7 (行5)
        第3列: 庄15-17 (行0-2), 闲14 (行4), 庄8 (行5)
        """
        road = RoadData(road_type="big_road", display_name="大路")
        
        if not all_entries:
            return road
        
        # 记录每列被占用的行：column -> set of occupied rows
        occupied: Dict[int, Set[int]] = {}
        
        def is_occupied(col: int, row: int) -> bool:
            return row in occupied.get(col, set())
        
        def occupy(col: int, row: int):
            if col not in occupied:
                occupied[col] = set()
            occupied[col].add(row)
        
        def find_next_available_row(col: int, start_row: int) -> int:
            """从start_row开始找第一个可用行，如果没有则返回MAX_ROWS_PER_COLUMN（表示需要继续向右拐弯）"""
            row = start_row
            while row < self.MAX_ROWS_PER_COLUMN and is_occupied(col, row):
                row += 1
            return row
        
        def find_available_row_upward(col: int, start_row: int) -> int:
            """从start_row开始向上找第一个可用行（用于拐弯时），如果没有则返回-1"""
            row = start_row
            while row >= 0 and is_occupied(col, row):
                row -= 1
            return row
        
        def find_leftmost_available_column(min_col: int, max_col: int) -> int:
            """从min_col到max_col找第一个有空位的列"""
            for col in range(min_col, max_col + 1):
                occupied_rows = occupied.get(col, set())
                if len(occupied_rows) < self.MAX_ROWS_PER_COLUMN:
                    return col
            return max_col + 1
        
        # 状态跟踪
        current_col = 0
        current_row = 0
        prev_value = None
        prev_was_tie = False
        
        # 记录当前长龙的起始列
        current_dragon_start_col = 0

        for game_number, result in all_entries:
            is_tie = (result == "和")

            if is_tie:
                # 和局处理：在上一局位置标记
                if road.points:
                    for i in range(len(road.points) - 1, -1, -1):
                        if not road.points[i].is_tie:
                            road.points[i].has_tie = True
                            break
                else:
                    # 如果开局第一把就是和局，由于没有前置点可以标记，
                    # 按照百家乐标准画法，通常会在随后出现的第一个庄/闲点上画一条绿线
                    # 这里我们将它临时存入一个状态变量中
                    prev_was_tie = True
                continue

            # 庄/闲处理
            is_new_col = False

            if prev_value is None:
                # 第一个庄/闲点
                is_new_col = True
                current_dragon_start_col = 0
            elif result == prev_value:
                # 相同结果：向下延伸（和局绝对不会打断长龙）
                next_row = current_row + 1
                
                if next_row >= self.MAX_ROWS_PER_COLUMN:
                    # 超过6行，拐弯到下一列
                    occupy(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                    current_col += 1
                    is_new_col = True
                    # 在下一列找第一个可用行（从最后一行向上找）
                    current_row = find_available_row_upward(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                    # 如果下一列也没有可用行，继续向右找
                    while current_row < 0:
                        current_col += 1
                        current_row = find_available_row_upward(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                elif is_occupied(current_col, next_row):
                    # 下一行被占用，拐弯
                    occupy(current_col, current_row)
                    current_col += 1
                    is_new_col = True
                    # 在下一列找第一个可用行（从next_row向上找）
                    current_row = find_available_row_upward(current_col, next_row)
                    # 如果下一列也没有可用行，继续向右找
                    while current_row < 0:
                        current_col += 1
                        current_row = find_available_row_upward(current_col, next_row)
                else:
                    # 正常向下
                    current_row = next_row
            else:
                # 不同结果：换新列
                # 关键修改：从当前长龙起始列的下一列开始，找最左边的有空位列
                # 这样可以回填到被长龙拐弯占用的列中
                current_col = find_leftmost_available_column(current_dragon_start_col + 1, current_col)
                is_new_col = True
                # 从第0行开始，跳过被占用的行
                current_row = find_next_available_row(current_col, 0)
                
                # 如果当前列已满（没有可用行），则向右找新列
                if current_row >= self.MAX_ROWS_PER_COLUMN:
                    current_col += 1
                    current_row = find_next_available_row(current_col, 0)
                
                # 更新长龙起始列为当前列
                current_dragon_start_col = current_col
            
            # 标记占用
            occupy(current_col, current_row)
            
            # 创建点
            error_id = self.error_map.get(game_number)
            point = RoadPoint(
                game_number=game_number,
                column=current_col,
                row=current_row,
                value=result,
                is_new_column=is_new_col,
                error_id=error_id,
                is_tie=False,
            )
            road.points.append(point)
            
            # 如果开局出现了和局，而当时路牌上还没点，我们将这个和局附加到第一个开出的庄/闲上
            if prev_was_tie and prev_value is None:
                point.has_tie = True
            
            prev_value = result
            prev_was_tie = False
        
        # 更新尺寸
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = max(p.row for p in road.points) + 1
        
        return road
    
    def _layout_derived_road(self, color_sequence: List[Tuple[int, str]], road_type: str, display_name: str) -> RoadData:
        """
        下三路通用布局算法 - 使用和大路完全相同的拐弯逻辑
        
        规则：
        1. 相同颜色往下排（纵向延伸）
        2. 不同颜色换新列（从下一列开始，跳过被占用的行）
        3. 每列最多 MAX_ROWS_PER_COLUMN(6) 行
        4. 长龙拐弯规则：当一列超过6个时，第7个开始向右拐弯
        
        Args:
            color_sequence: [(game_number, color), ...] 颜色序列，color为"红"或"蓝"
            road_type: 路牌类型
            display_name: 显示名称
        
        Returns:
            RoadData: 布局好的路牌数据
        """
        road = RoadData(road_type=road_type, display_name=display_name)
        
        if not color_sequence:
            return road
        
        # 记录每列被占用的行
        occupied: Dict[int, Set[int]] = {}
        
        def is_occupied(col: int, row: int) -> bool:
            return row in occupied.get(col, set())
        
        def occupy(col: int, row: int):
            if col not in occupied:
                occupied[col] = set()
            occupied[col].add(row)
        
        def find_next_available_row(col: int, start_row: int) -> int:
            """从start_row开始找第一个可用行"""
            row = start_row
            while row < self.MAX_ROWS_PER_COLUMN and is_occupied(col, row):
                row += 1
            return row
        
        def find_available_row_upward(col: int, start_row: int) -> int:
            """从start_row开始向上找第一个可用行（用于拐弯时）"""
            row = start_row
            while row >= 0 and is_occupied(col, row):
                row -= 1
            return row
        
        def find_leftmost_available_column(min_col: int, max_col: int) -> int:
            """从min_col到max_col找第一个有空位的列"""
            for col in range(min_col, max_col + 1):
                occupied_rows = occupied.get(col, set())
                if len(occupied_rows) < self.MAX_ROWS_PER_COLUMN:
                    return col
            return max_col + 1
        
        # 状态跟踪
        current_col = 0
        current_row = 0
        prev_color = None
        current_dragon_start_col = 0
        
        for game_number, color in color_sequence:
            is_new_col = False
            
            if prev_color is None:
                # 第一个点
                is_new_col = True
                current_dragon_start_col = 0
            elif color == prev_color:
                # 相同颜色：尝试向下延伸
                next_row = current_row + 1
                
                if next_row >= self.MAX_ROWS_PER_COLUMN:
                    # 超过6行，拐弯到下一列
                    occupy(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                    current_col += 1
                    is_new_col = True
                    current_row = find_available_row_upward(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                    while current_row < 0:
                        current_col += 1
                        current_row = find_available_row_upward(current_col, self.MAX_ROWS_PER_COLUMN - 1)
                elif is_occupied(current_col, next_row):
                    # 下一行被占用，拐弯
                    occupy(current_col, current_row)
                    current_col += 1
                    is_new_col = True
                    current_row = find_available_row_upward(current_col, next_row)
                    while current_row < 0:
                        current_col += 1
                        current_row = find_available_row_upward(current_col, next_row)
                else:
                    # 正常向下
                    current_row = next_row
            else:
                # 不同颜色：换新列
                current_col = find_leftmost_available_column(current_dragon_start_col + 1, current_col)
                is_new_col = True
                current_row = find_next_available_row(current_col, 0)
                
                if current_row >= self.MAX_ROWS_PER_COLUMN:
                    current_col += 1
                    current_row = find_next_available_row(current_col, 0)
                
                current_dragon_start_col = current_col
            
            # 标记占用
            occupy(current_col, current_row)
            
            # 创建点
            point = RoadPoint(
                game_number=game_number,
                column=current_col,
                row=current_row,
                value=color,
                is_new_column=is_new_col,
            )
            road.points.append(point)
            
            prev_color = color
        
        # 更新尺寸
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = max(p.row for p in road.points) + 1
        
        return road
    
    def _calculate_bead_road(self, entries: List[Tuple[int, str]]) -> RoadData:
        """
        珠盘路算法 — 14列×6行网格
        
        按时间顺序从左到右、从上到下填充
        """
        road = RoadData(road_type="bead_road", display_name="珠盘路")
        
        col, row = 0, 0
        for game_number, result in entries:
            error_id = self.error_map.get(game_number)
            point = RoadPoint(
                game_number=game_number,
                column=col,
                row=row,
                value=result,
                error_id=error_id,
                is_tie=(result == "和"),
            )
            road.points.append(point)
            
            # 下一位置
            row += 1
            if row >= self.BEAD_ROAD_ROWS:
                row = 0
                col += 1
        
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = self.BEAD_ROAD_ROWS
        
        return road
    
    def _calculate_derived_road_standard(self, big_road: RoadData, k: int, road_type: str, display_name: str) -> RoadData:
        """
        通用的下三路（衍生路）标准澳门算法：大眼仔(k=1)、小路(k=2)、曱甴路(k=3)
        
        核心规则：
        - 齐整：大路换列的第一粒（落在第0行），比较前1列与前k+1列的长度是否相等
        - 有无：大路同列向下的第二粒及以后（落在第1行及以下），向左看k列的同一行是否有记录
        - 直落：接在“有无”之后，如果向左看k列为空，且其上一行向左看k列也为空，则为直落
        """
        road = RoadData(road_type=road_type, display_name=display_name)
        if not big_road.points:
            return road
            
        # 建立大路坐标矩阵： (col, row) -> RoadPoint，用于快速查找
        # 必须排除和局点，因为下三路是不看和局的
        matrix: Dict[Tuple[int, int], RoadPoint] = {}
        # 记录每列的真实长度（排除和局和拐弯导致的行跳跃，这里我们直接记录该列有多少个非和局点）
        # 但是“齐整”看的是列的“长度”。对于拐弯的情况，澳门规则是将拐弯的子算在同一列里。
        # 也就是：一列的“长度” = 该列在逻辑上包含的点的数量。
        # 我们需要先按逻辑列分组，恢复没有视觉拐弯时的大路。
        
        logical_cols: Dict[int, int] = {} # 逻辑列索引 -> 长度
        
        # 提取所有的逻辑列。大路中，每次 is_new_column = True 就代表新的逻辑列。
        current_logical_col = -1
        logical_matrix: Dict[Tuple[int, int], RoadPoint] = {} # (逻辑列, 逻辑行) -> Point
        
        for p in big_road.points:
            if p.is_tie:
                continue
            if p.is_new_column:
                current_logical_col += 1
                logical_cols[current_logical_col] = 0
            
            logical_row = logical_cols[current_logical_col]
            logical_matrix[(current_logical_col, logical_row)] = p
            logical_cols[current_logical_col] += 1

        color_sequence = []
        
        # 起始列规则：大眼仔k=1(起始第1列第1行或第2列第0行)
        # 逻辑列从0开始。
        for col in range(1, current_logical_col + 1):
            length = logical_cols[col]
            for row in range(length):
                p = logical_matrix[(col, row)]
                
                # 检查是否满足该路的起始条件
                # 起始列：col >= k 且 (row >= 1 或 col >= k + 1)
                if col < k:
                    continue
                if col == k and row == 0:
                    continue
                    
                color = "蓝" # 默认蓝
                
                if row == 0:
                    # 换列第一粒 -> 齐整
                    # 比较 col - 1 的长度 和 col - (k + 1) 的长度
                    len_prev = logical_cols[col - 1]
                    len_ref = logical_cols[col - (k + 1)]
                    if len_prev == len_ref:
                        color = "红"
                    else:
                        color = "蓝"
                else:
                    # 同列向下 -> 有无 / 直落
                    # 向左看k列的同一行是否有记录
                    ref_col = col - k
                    if (ref_col, row) in logical_matrix:
                        color = "红" # 有无：有 -> 红
                    else:
                        # 有无：无，检查直落
                        # 上一行向左看k列是否也为空
                        if (ref_col, row - 1) not in logical_matrix:
                            color = "红" # 直落：空且上为空 -> 红
                        else:
                            color = "蓝" # 有无：空且上不为空 -> 蓝
                            
                color_sequence.append((p.game_number, color))
                
        # 按照和大路相同的布局规则生成下三路的网格
        return self._layout_derived_road(color_sequence, road_type, display_name)

    def _calculate_big_eye_road(self, big_road: RoadData) -> RoadData:
        return self._calculate_derived_road_standard(big_road, 1, "big_eye", "大眼仔路")

    def _calculate_small_road(self, big_road: RoadData) -> RoadData:
        return self._calculate_derived_road_standard(big_road, 2, "small_road", "小路")

    def _calculate_cockroach_road(self, big_road: RoadData) -> RoadData:
        return self._calculate_derived_road_standard(big_road, 3, "cockroach_road", "螳螂路")


# 便捷函数
def calculate_roads(entries: List[Tuple[int, str]], error_map: Optional[Dict[int, int]] = None) -> Dict[str, RoadData]:
    """
    计算所有路牌的便捷函数
    
    Args:
        entries: [(game_number, result), ...]
        error_map: 可选的错误映射
    
    Returns:
        所有路牌数据字典
    """
    engine = RoadEngine(error_map=error_map)
    return engine.calculate_all_roads(entries)


def get_road_as_grid(road_data: RoadData, default_rows: int = 6) -> List[List[Optional[RoadPoint]]]:
    """
    将路牌数据转换为网格格式便于显示
    
    Args:
        road_data: 路牌数据
        default_rows: 默认行数
    
    Returns:
        二维网格，grid[row][col]
    """
    if not road_data.points:
        return []
    
    max_col = max(p.column for p in road_data.points) + 1
    max_row = max(p.row for p in road_data.points) + 1
    rows = max(max_row, default_rows)
    
    # 创建空网格
    grid: List[List[Optional[RoadPoint]]] = [
        [None for _ in range(max_col)] for _ in range(rows)
    ]
    
    # 填充数据
    for point in road_data.points:
        if 0 <= point.row < rows and 0 <= point.column < max_col:
            grid[point.row][point.column] = point
    
    return grid


# 统一路牌引擎别名（兼容旧代码）
class UnifiedRoadEngine(RoadEngine):
    """
    统一路牌引擎 - 兼容旧API
    支持从数据库直接获取路牌数据
    """
    
    async def get_all_roads(self, boot_number: int) -> Dict[str, RoadData]:
        """
        从数据库获取路牌数据（兼容旧API）
        
        Args:
            boot_number: 靴号
            
        Returns:
            Dict[str, RoadData]: 所有路牌数据
        """
        # 延迟导入以避免循环依赖
        from app.core.database import async_session
        from app.models.schemas import GameRecord
        from sqlalchemy import select
        
        async with async_session() as session:
            # 获取所有记录（包括和局），用于珠盘路显示
            query = select(GameRecord).where(
                GameRecord.boot_number == boot_number,
            ).order_by(GameRecord.game_number)
            
            result = await session.execute(query)
            records = result.scalars().all()
            
            entries = [(r.game_number, r.result) for r in records]
            return self.calculate_all_roads(entries)


# 保持向后兼容
RoadEngine = UnifiedRoadEngine
