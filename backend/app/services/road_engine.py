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
        派生路算法（大眼仔路、小路、螳螂路）
        跟大路布局一样但颜色不代表庄闲
        
        大眼仔路：大路每列第1个与前一列对比
        小路：大路每列第1个与前2列对比  
        螳螂路：大路每列第1个与前3列对比
        
        规则：
        - 前一列同行有值 -> 红（重复），跟大路类似但颜色含义不同
        - 前一列同行无值 -> 蓝（跳变）
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
        
        # 建立大路坐标索引
        big_road_grid: Dict[Tuple[int, int], RoadPoint] = {}
        for p in big_road.points:
            big_road_grid[(p.column, p.row)] = p
        
        # 找到大路每列的第一个点
        columns_points: Dict[int, List[RoadPoint]] = {}
        for p in big_road.points:
            if p.column not in columns_points:
                columns_points[p.column] = []
            columns_points[p.column].append(p)
        
        sorted_columns = sorted(columns_points.keys())
        
        column = 0
        row = 0
        prev_value = None
        
        for col_idx in range(offset, len(sorted_columns)):
            current_col = sorted_columns[col_idx]
            prev_col = sorted_columns[col_idx - offset]
            
            if current_col not in columns_points or prev_col not in columns_points:
                continue
            
            current_first = columns_points[current_col][0]
            prev_first = columns_points[prev_col][0]
            
            # 判断：前一列同行是否有值
            prev_col_length = len(columns_points[prev_col])
            
            if current_first.row < prev_col_length:
                # 前一列同行有值 -> "红"（延伸）
                derived_value = "延"
            else:
                # 前一列同行无值 -> "蓝"（转折）
                derived_value = "转"
            
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
