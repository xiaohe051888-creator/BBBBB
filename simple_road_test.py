#!/usr/bin/env python3
"""
简单五路走势图测试
"""

import sys
import os

# 添加后端路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend/app'))

try:
    from services.road_engine import UnifiedRoadEngine
    print("✅ 成功导入UnifiedRoadEngine")
    
    # 测试基本功能
    engine = UnifiedRoadEngine()
    
    # 测试数据
    test_results = ["庄", "闲", "庄", "闲", "和", "庄", "庄", "庄", "闲", "闲"]
    
    print(f"测试数据: {test_results}")
    
    for i, result in enumerate(test_results):
        engine.process_game(i+1, result)
    
    roads = engine.calculate_all_roads()
    
    print(f"\n大路点数: {len(roads.big_road.points)}")
    print(f"珠盘路点数: {len(roads.bead_road.points)}")
    print(f"大眼仔路点数: {len(roads.big_eye_boy.points)}")
    print(f"小路点数: {len(roads.small_road.points)}")
    print(f"蟑螂路点数: {len(roads.cockroach_road.points)}")
    
    # 显示大路点
    print("\n大路点详情:")
    for point in roads.big_road.points:
        color = "红" if point.value == "庄" else "蓝" if point.value == "闲" else "绿"
        print(f"  局号{point.game_number}: {point.value}({color}) - 列{point.column+1}, 行{point.row+1}")
    
    print("\n✅ 测试成功！引擎工作正常")
    
except ImportError as e:
    print(f"❌ 导入错误: {e}")
    print("当前Python路径:")
    for p in sys.path:
        print(f"  {p}")
except Exception as e:
    print(f"❌ 测试错误: {e}")
    import traceback
    traceback.print_exc()