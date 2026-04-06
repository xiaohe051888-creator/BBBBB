"""
统一引擎 - 五路走势图算法
大路、珠盘路、大眼仔路、小路、螳螂路
输出：5路2D实时完整带血迹走势图
"""
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class RoadPoint:
    """走势图上的一个点"""
    game_number: int       # 局号
    column: int            # 列坐标（从0开始）
    row: int               # 行坐标（从0开始）
    value: str             # 值：庄/闲
    is_new_column: bool = False  # 是否新列起始
    error_id: Optional[str] = None  # 错误标记


@dataclass 
class RoadData:
    """单条路的完整数据"""
    road_type: str         # 路类型名称
    display_name: str      # 展示名称
    points: List[RoadPoint] = field(default_factory=list)
    max_columns: int = 0
    max_rows: int = 0


@dataclass
class FiveRoadResult:
    """五路算法完整输出"""
    big_road: RoadData      # 大路
    bead_road: RoadData     # 珠盘路
    big_eye_boy: RoadData   # 大眼仔路
    small_road: RoadData    # 小路
    cockroach_road: RoadData # 螳螂路
    
    # 走势图尺寸约束
    BEAD_COLUMNS: int = 14
    BEAD_MAX_ROWS: int = 6


class UnifiedRoadEngine:
    """
    统一路引擎 - 五路走势图计算
    
    业务认知前提：
    - 单局开奖结果是随机事件，不存在固定长期必然规律
    - 五路在排列、布局、显示维度存在差异，会形成短暂可用的阶段性特征
    - 阶段性特征可能随时中断，模型必须动态判断而非固定套用单一路径
    """
    
    def __init__(self):
        self.current_game_numbers: List[int] = []  # 当靴所有局号
        self.current_results: List[str] = []       # 当靴所有结果（庄/闲/和）
        self.error_map: Dict[int, str] = {}        # 局号 -> 错误编号
    
    def set_error_marks(self, error_map: Dict[int, str]):
        """设置错误标记映射"""
        self.error_map = error_map
    
    def process_game(self, game_number: int, result: str) -> FiveRoadResult:
        """
        处理新一局，生成五路完整走势图
        
        Args:
            game_number: 局号
            result: 开奖结果（庄/闲/和）
            
        Returns:
            FiveRoadResult 五路完整数据
        """
        self.current_game_numbers.append(game_number)
        self.current_results.append(result)
        
        return self.calculate_all_roads()
    
    def calculate_all_roads(self) -> FiveRoadResult:
        """计算五路完整走势图"""
        # 过滤有效结果（庄和闲，不和局）
        valid_entries = [
            (gn, r) for gn, r in zip(self.current_game_numbers, self.current_results)
            if r in ("庄", "闲")
        ]
        
        big_road = self._calculate_big_road(valid_entries)
        bead_road = self._calculate_bead_road(valid_entries)
        big_eye_boy = self._calculate_derived_road(big_road, "大眼仔路")
        small_road = self._calculate_derived_road(big_road, "小路")
        cockroach_road = self._calculate_derived_road(big_road, "螳螂路")
        
        return FiveRoadResult(
            big_road=big_road,
            bead_road=bead_road,
            big_eye_boy=big_eye_boy,
            small_road=small_road,
            cockroach_road=cockroach_road,
        )
    
    def _calculate_big_road(self, valid_entries: List[Tuple[int, str]]) -> RoadData:
        """
        大路算法
        规则：相同颜色一组最多6个，颜色变化必换列
        """
        road = RoadData(road_type="big_road", display_name="大路")
        
        if not valid_entries:
            return road
        
        column = 0
        row = 0
        prev_value = None
        
        for game_number, result in valid_entries:
            is_new_col = False
            
            if prev_value is None:
                # 第一个点
                is_new_col = True
            elif result == prev_value:
                # 相同，继续往下
                row += 1
                # 最多6个一行（大路约束）
                if row >= 6:
                    row = 5
                    column += 1
                    is_new_col = True
            else:
                # 颜色变化，换列
                column += 1
                row = 0
                is_new_col = True
            
            error_id = self.error_map.get(game_number)
            point = RoadPoint(
                game_number=game_number,
                column=column,
                row=row,
                value=result,
                is_new_column=is_new_col,
                error_id=error_id,
            )
            road.points.append(point)
            prev_value = result
        
        # 更新尺寸
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = max(p.row for p in road.points) + 1
        
        return road
    
    def _calculate_bead_road(self, valid_entries: List[Tuple[int, str]]) -> RoadData:
        """
        珠盘路算法
        规则：14列×6行，从左到右、从下到上依次填入，颜色不代表庄闲
        """
        road = RoadData(road_type="bead_road", display_name="珠盘路")
        
        if not valid_entries:
            return road
        
        columns = 14
        max_rows = 6
        
        for idx, (game_number, result) in enumerate(valid_entries):
            col = idx % columns
            row = (idx // columns) % max_rows
            
            error_id = self.error_map.get(game_number)
            point = RoadPoint(
                game_number=game_number,
                column=col,
                row=row,
                value=result,
                is_new_column=(col == 0 and idx > 0),
                error_id=error_id,
            )
            road.points.append(point)
        
        road.max_columns = columns
        road.max_rows = min(max_rows, ((len(valid_entries) - 1) // columns) + 1)
        
        return road
    
    def _calculate_derived_road(self, big_road: RoadData, road_type: str) -> RoadData:
        """
        派生路算法（大眼仔路、小路、螳螂路）— 标准澳门/拉斯维加斯规则
        
        三条派生路都是从大路(Big Road)衍生出来的，排列规则与大路相同：
        - 相同则往下排（延/红）
        - 不同则换新列（转/蓝）
        
        颜色含义（不代表庄闲！）：
        - 红(延) = 与前参照列结构相同（规律延续）
        - 蓝(转) = 与前参照列结构不同（规律转折）
        
        === 核心判断规则（奇偶列法）===
        
        对于当前列 i（从offset开始），需要回看前面第offset列 (i-offset)：
        
        规则1 — 当前列为**偶数列**（从1开始计数）时：
          比较当前列首行的row vs 参考列的长度（即行数）
          - 若 current_row < ref_col_length → 参考列同行有值 → 红(延)
          - 若 current_row >= ref_col_length → 参考列同行无值 → 蓝(转)
        
        规则2 — 当前列为**奇数列**时：
          比较当前结果与前一个结果是否相同（跳过和局）
          - 相同 → 红(延)
          - 不同 → 蓝(转)
        
        起始位置（何时开始画第一个点）：
        - 大眼仔路(offset=1): 从大路第2列开始（需要第1列作为参考）
        - 小路(offset=2):     从大路第3列开始（需要第2列作为参考）
        - 螳螂路(offset=3):   从大路第4列开始（需要第3列作为参考）
        
        参考: baccaratsmart.com, baccarat.net, gamblingforums.com
        """
        display_names = {
            "大眼仔路": "大眼仔路",
            "小路": "小路",
            "螳螂路": "螳螂路",
        }
        
        # 派生路的比较列数偏移
        compare_offsets = {
            "大眼仔路": 1,
            "小路": 2,
            "螳螂路": 3,
        }
        
        road = RoadData(road_type=road_type, display_name=display_names.get(road_type, road_type))
        
        if not big_road.points or len(big_road.points) < 2:
            return road
        
        offset = compare_offsets.get(road_type, 1)
        
        # 找到大路每列的所有点（按行号排序）
        columns_points: Dict[int, List[RoadPoint]] = {}
        for p in big_road.points:
            if p.column not in columns_points:
                columns_points[p.column] = []
            columns_points[p.column].append(p)
        
        # 确保每列内部按row排序
        for col in columns_points:
            columns_points[col].sort(key=lambda x: x.row)
        
        sorted_columns = sorted(columns_points.keys())
        
        if len(sorted_columns) <= offset:
            return road  # 列数不足，无法计算
        
        # 构建结果序列（用于奇数列的"相同/不同"判断）
        # 结果序列只包含庄/闲（不含和）
        result_sequence: List[str] = []       # 庄/闲序列
        col_for_result: List[int] = []       # 每个结果所属的大路列号
        for col in sorted_columns:
            for p in columns_points[col]:
                result_sequence.append(p.value)
                col_for_result.append(col)
        
        column = 0
        row = 0
        prev_value = None
        
        # 遍历从 offset 列开始的每一列
        for col_idx in range(offset, len(sorted_columns)):
            current_col = sorted_columns[col_idx]
            ref_col = sorted_columns[col_idx - offset]  # 参考列
            
            if current_col not in columns_points or ref_col not in columns_points:
                continue
            
            current_first = columns_points[current_col][0]  # 当前列第一个点
            ref_col_points = columns_points[ref_col]         # 参考列所有点
            ref_col_length = len(ref_col_points)             # 参考列长度
            
            # === 奇偶列判断（1-based）===
            # 当前列在派生路中的序号（1-based）
            derived_col_position = col_idx - offset + 1  # 第1,2,3...个派生路列
            
            if derived_col_position % 2 == 1:
                # ===== 奇数列规则：比较当前结果与前一个结果是否相同 =====
                # 找到current_first在result_sequence中的位置
                try:
                    idx = result_sequence.index(current_first.value, 
                        max(0, sum(1 for c in col_for_result[:col_idx] for _ in [])) if False else 0)
                    # 更简单的做法：找到当前点之前最近的一个有效结果的index
                except (ValueError, TypeError):
                    pass
                
                # 找当前点之前的最后一个结果
                prev_result = None
                for i in range(len(result_sequence) - 1, -1, -1):
                    target_point = None
                    # 在当前列中找当前first point之前的点
                    found = False
                    for cp in columns_points[current_col]:
                        if cp.row < current_first.row:
                            target_point = cp
                            break
                        elif cp == current_first:
                            found = True
                            break
                    if target_point:
                        prev_result = target_point.value
                        break
                    
                    # 在之前列中找最后一个点
                    if not found or target_point is None:
                        for prev_c in reversed(sorted_columns[:col_idx]):
                            if columns_points[prev_c]:
                                prev_result = columns_points[prev_c][-1].value
                                break
                        break
                
                if prev_result is not None and current_first.value == prev_result:
                    derived_value = "延"   # 红 — 与前一结果相同
                else:
                    derived_value = "转"   # 蓝 — 与前一结果不同或无法比较
            else:
                # ===== 偶数列规则：比较当前列首行row vs 参考列长度 =====
                if current_first.row < ref_col_length:
                    # 参考列在当前首行位置有数据（同行有值）
                    derived_value = "延"   # 红 — 结构相同/延伸
                else:
                    # 参考列在当前首行位置无数据（需要换行才能到）
                    derived_value = "转"   # 蓝 — 结构转折/跳变
            
            # 按大路规则排列派生路点：相同往下，不同换列
            is_new_col = False
            if prev_value is None:
                is_new_col = True
            elif derived_value != prev_value:
                column += 1
                row = 0
                is_new_col = True
            else:
                row += 1
            
            error_id = self.error_map.get(current_first.game_number)
            point = RoadPoint(
                game_number=current_first.game_number,
                column=column,
                row=row,
                value=derived_value,
                is_new_column=is_new_col,
                error_id=error_id,
            )
            road.points.append(point)
            prev_value = derived_value
        
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = max(p.row for p in road.points) + 1
        
        return road
    
    def get_road_as_grid(self, road: RoadData) -> List[List[Optional[RoadPoint]]]:
        """将路数据转换为二维网格，便于前端渲染"""
        if not road.points:
            return []
        
        grid = []
        for r in range(road.max_rows):
            row = []
            for c in range(road.max_columns):
                point = next((p for p in road.points if p.column == c and p.row == r), None)
                row.append(point)
            grid.append(row)
        
        return grid
    
    def reset_boot(self):
        """新靴开始，重置引擎"""
        self.current_game_numbers = []
        self.current_results = []
        self.error_map = {}
