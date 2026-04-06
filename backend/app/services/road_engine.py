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
    
    全局常量（标准百家乐规则）:
    - MAX_ROWS_PER_COLUMN: 大路和派生路每列最大行数（6个一行后换列）
    - BEAD_COLUMNS: 珠盘路固定列数（14）
    - BEAD_MAX_ROWS: 珠盘路固定最大行数（6）
    """
    
    # === 标准规则常量 ===
    MAX_ROWS_PER_COLUMN = 6   # 大路/派生路每列最多6个点（全球统一）
    BEAD_COLUMNS = 14         # 珠盘路固定14列
    BEAD_MAX_ROWS = 6         # 珠盘路固定6行
    
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
        大路算法 — 标准澳门/拉斯维加斯规则
        
        规则：
        1. 相同结果往下排（纵向延伸）
        2. 不同结果换新列（从下一列第一行开始）
        3. 每列最多 MAX_ROWS_PER_COLUMN(6) 个点，超过则折到右侧新列继续
        4. "和"局在调用前已过滤，此处只处理庄/闲
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
                # 第一个点：放在(0,0)，标记为新列
                is_new_col = True
            elif result == prev_value:
                # 相同结果：向下延伸一行
                row += 1
                # 关键约束：每列最多MAX_ROWS_PER_COLUMN个点（标准大路规则）
                # 第7个相同结果时折到右侧新列的最后一行位置
                if row >= self.MAX_ROWS_PER_COLUMN:
                    row = self.MAX_ROWS_PER_COLUMN - 1
                    column += 1
                    is_new_col = True
            else:
                # 不同结果：开启新列，从第0行开始
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
        
        # 更新尺寸信息
        if road.points:
            road.max_columns = max(p.column for p in road.points) + 1
            road.max_rows = max(p.row for p in road.points) + 1
        
        return road
    
    def _calculate_bead_road(self, valid_entries: List[Tuple[int, str]]) -> RoadData:
        """
        珠盘路算法 — 标准固定网格布局
        
        规则：
        - 固定 BEAD_COLUMNS(14)列 × BEAD_MAX_ROWS(6)行 网格
        - 从左到右、从上到下依次填入（row=0在顶部）
        - 颜色直接表示庄(红)/闲(蓝)
        - 超过 14×6=84 个点时，旧位置会被新数据覆盖（取模行为）
        
        注意: 珠盘路的坐标方向与大路不同！
        - 大路: 自适应行列，向下延伸
        - 珠盘路: 固定网格，从左上角开始逐行填入
        """
        road = RoadData(road_type="bead_road", display_name="珠盘路")
        
        if not valid_entries:
            return road
        
        columns = self.BEAD_COLUMNS
        max_rows = self.BEAD_MAX_ROWS
        
        for idx, (game_number, result) in enumerate(valid_entries):
            # 取模实现循环覆盖（标准珠盘路行为）
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
        派生路算法（大眼仔路、小路、螳螂路）— 标准澳门/拉斯维加斯两种情形法
        
        三条派生路都是从大路(Big Road)衍生出来的，排列规则与大路相同：
        - 相同则往下排（红/延）
        - 不同则换新列（蓝/转）
        
        颜色含义（不代表庄闲！）：
        - 红(延) = 规律延续/模式一致
        - 蓝(转) = 规律转折/模式断裂
        
        === 核心判断规则（两种情形法）===

        来源交叉验证 (5个国外权威网站):
        - baccarat.net (Caroline Richardson, 2026)
        - baccaratprotips.com (Greg Wilson, 2026)  
        - gamblingforums.com (@Jimske, 2022)
        - baccarattraining.com (Andy Nichols, 2025)
        - livedealer.org (Microgaming团队, 2010-2024)

        参数定义:
        - k (周期/偏移): 大眼仔=1, 小路=2, 螳螂路=3
        - m: 最新结果在大路中的行号(1-based, 从上到下)
        - n: 最新结果在大路中的列号(1-based, 从左到右)
        - p: 参考列(n-k)的图标总数(不含Tie)

        === 情形A: 新列出现（m=1，大路开启新列）===
        比较新列左边第1列 vs 左边第(k+1)列的**高度是否相等**
        - 高度相等 → 红(延)
        - 高度不等 → 蓝(转)

        注: 这等价于livedealer.org的"虚拟反转法"
             m=1时先反转结果计算再反转颜色
        
        === 情形B: 延续当前列（m>=2，大路在当前列向下添加）===
        从当前点位置向左移k格，再向上移1格，检查该位置**是否有值**
        - 有值（同行有数据）→ 红(延)
        - 无值（同行无数据）→ 蓝(转)

        起始位置（需要足够的列才开始画）:
        - 大眼仔路(k=1): 从大路第2列开始（第2列出现后才有第1个点）
        - 小路(k=2):     从大路第3列开始
        - 螳螂路(k=3):   从大路第4列开始
        """
        display_names = {
            "大眼仔路": "大眼仔路",
            "小路": "小路",
            "螳螂路": "螳螂路",
        }
        
        # 派生路的比较列数偏移 k
        compare_offsets = {
            "大眼仔路": 1,
            "小路": 2,
            "螳螂路": 3,
        }
        
        road = RoadData(road_type=road_type, display_name=display_names.get(road_type, road_type))
        
        if not big_road.points or len(big_road.points) < 2:
            return road
        
        k = compare_offsets.get(road_type, 1)
        
        # === 构建大路网格索引 ===
        # columns_points[col] = 该列所有点的列表(按row排序)
        columns_points: Dict[int, List[RoadPoint]] = {}
        for p in big_road.points:
            if p.column not in columns_points:
                columns_points[p.column] = []
            columns_points[p.column].append(p)
        for col in columns_points:
            columns_points[col].sort(key=lambda x: x.row)
        
        # 构建快速查找网格: grid[(col, row)] = point
        grid: Dict[Tuple[int, int], RoadPoint] = {}
        for p in big_road.points:
            grid[(p.column, p.row)] = p
        
        sorted_columns = sorted(columns_points.keys())
        
        if len(sorted_columns) <= k:
            return road  # 列数不足，无法计算
        
        # === 遍历大路每个有效结果点（不是只遍历每列的第一个！）===
        # 派生路的每个点对应大路中从第(k+1)列开始的每一个结果
        der_column = 0   # 派生路列号
        der_row = 0      # 派生路行号
        prev_value = None  # 上一个派生路值（用于判断换列）
        
        for point in big_road.points:
            # 当前点在大路中的坐标 (0-based)
            m = point.row + 1      # 行号 (1-based, 用于算法判断)
            n_0based = point.column  # 列号 (0-based)
            
            # 只处理从第k列开始的点（即大路第k+1列及之后）
            if n_0based < k:
                continue
            
            # 参考列号 (向左偏移k列)
            ref_col = n_0based - k
            
            if ref_col not in columns_points:
                continue
            
            ref_col_length = len(columns_points[ref_col])  # 参考列的长度p
            
            # === 两种情形判断 ===
            is_new_in_big_road = (point.row == 0)  # 是否是大路的新列起始(m==1)
            
            if is_new_in_big_road:
                # ===== 情形A: 新列出现 (m=1) =====
                # 比较左边第1列 vs 左边第(k+1)列的高度
                # 注意：当开启新列时，左边第1列就是 n_0based-1
                
                left_col1 = n_0based - 1  # 新列紧邻的左边第1列
                left_col_k1 = n_0based - (k + 1)  # 左边第(k+1)列
                
                if left_col1 in columns_points and left_col_k1 in columns_points:
                    height1 = len(columns_points[left_col1])
                    height_k1 = len(columns_points[left_col_k1])
                    
                    if height1 == height_k1:
                        derived_value = "延"   # 红 — 两列高度相等
                    else:
                        derived_value = "转"   # 蓝 — 两列高度不等
                else:
                    # 参考列不存在时的fallback
                    derived_value = "转"
            else:
                # ===== 情形B: 延续当前列 (m>=2) =====
                # 从当前位置 向左移k格 再向上移1格
                check_col = n_0based - k
                check_row = point.row - 1  # 向上移1格
                
                if (check_col, check_row) in grid:
                    # 该位置有值 → 同行有数据
                    derived_value = "延"   # 红
                else:
                    # 该位置无值 → 同行无数据
                    derived_value = "转"   # 蓝
            
            # === 按大路规则排列派生路点：相同往下，不同换列 ===
            # 重要：派生路的排列规则与大路完全相同！
            # 包括每列最多 MAX_ROWS_PER_COLUMN(6) 个点的限制
            is_new_col = False
            if prev_value is None:
                is_new_col = True
            elif derived_value != prev_value:
                der_column += 1
                der_row = 0
                is_new_col = True
            else:
                der_row += 1
                # ★ 关键修复：派生路也必须遵守每列6行的限制！
                if der_row >= self.MAX_ROWS_PER_COLUMN:
                    der_row = self.MAX_ROWS_PER_COLUMN - 1
                    der_column += 1
                    is_new_col = True
            
            error_id = self.error_map.get(point.game_number)
            der_point = RoadPoint(
                game_number=point.game_number,
                column=der_column,
                row=der_row,
                value=derived_value,
                is_new_column=is_new_col,
                error_id=error_id,
            )
            road.points.append(der_point)
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
