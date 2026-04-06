#!/usr/bin/env python3
"""
下三路算法验证脚本
验证大眼仔路、小路、螳螂路的奇偶列判断规则是否正确

标准参考:
- 大眼仔路: offset=1, 从大路第2列开始
- 小路: offset=2, 从大路第3列开始  
- 螳螂路: offset=3, 从大路第4列开始

奇偶列规则(1-based):
  奇数列: 比较当前结果与前一个结果是否相同 → 同→红(延), 异→蓝(转)
  偶数列: 比较当前列首行row vs 参考列长度 → row<长度→红(延), row>=长度→蓝(转)
"""
import sys
sys.path.insert(0, '/Users/ww/WorkBuddy/20260405164649/BBBBB/backend')

from app.services.road_engine import UnifiedRoadEngine


def test_case_1_basic_long_streak():
    """
    测试用例1: 长连庄（最简单场景）
    结果序列: 庄庄庄庄庄庄 (6连庄)
    
    大路预期: 1列6个点（全部纵向排列）
    大眼仔路: 
      - 第1个派生点(大路第2列,奇): 比较当前vs前1 → 同→延
      - 第2个派生点(大路第3列,偶): 比较row vs ref_len
      ...依此类推，全应该是"延"(红)
    """
    print("\n" + "="*60)
    print("测试用例1: 6连庄")
    print("="*60)
    
    engine = UnifiedRoadEngine()
    
    results = ["庄", "庄", "庄", "庄", "庄", "庄"]
    for i, r in enumerate(results, 1):
        five_roads = engine.process_game(i, r)
    
    # 打印大路
    print(f"\n大路 ({len(five_roads.big_road.points)}点):")
    for p in five_roads.big_road.points:
        print(f"  列{p.column} 行{p.row}: {p.value}")
    
    # 打印下三路
    for road_name, road in [
        ("大眼仔路", five_roads.big_eye_boy),
        ("小路", five_roads.small_road),
        ("螳螂路", five_roads.cockroach_road),
    ]:
        print(f"\n{road_name} ({len(road.points)}点):")
        if not road.points:
            print("  (无数据 — 列数不足)")
        else:
            for p in road.points:
                print(f"  列{p.column} 行{p.row}: {p.value} (局{p.game_number})")
    
    return True


def test_case_2_choppy_alternating():
    """
    测试用例2: 庄闲交替（ choppy / 切饼）
    结果序列: 庄闲庄闲庄闲
    
    大路预期: 每列1个点（每次都换列），共6列
    大眼仔路: 
      - 每次比较都是"不同" → 全部为"转"(蓝)
      - 但排列时：相同往下，不同换列 → 所以每列只有1个点
    """
    print("\n" + "="*60)
    print("测试用例2: 庄闲交替")
    print("="*60)
    
    engine = UnifiedRoadEngine()
    
    results = ["庄", "闲", "庄", "闲", "庄", "闲"]
    for i, r in enumerate(results, 1):
        five_roads = engine.process_game(i, r)
    
    print(f"\n大路 ({len(five_roads.big_road.points)}点):")
    for p in five_roads.big_road.points:
        print(f"  列{p.column} 行{p.row}: {p.value}")
    
    for road_name, road in [
        ("大眼仔路", five_roads.big_eye_boy),
        ("小路", five_roads.small_road),
        ("螳螂路", five_roads.cockroach_road),
    ]:
        print(f"\n{road_name} ({len(road.points)}点):")
        if not road.points:
            print("  (无数据)")
        else:
            for p in road.points:
                print(f"  列{p.column} 行{p.row}: {p.value} (局{p.game_number})")
    
    return True


def test_case_3_mixed_with_doubles():
    """
    测试用例3: 含双连的混合模式（更接近真实）
    结果序列: 庄庄 闲闲 庄庄 闲  庄庄庄 闲闲 庄
    
    大路布局预判:
      Col0: 庄(0) 庄(1)
      Col1: 闲(0) 闲(1)
      Col2: 庄(0) 庄(1)
      Col3: 闲(0)
      Col4: 庄(0) 庄(1) 庄(2)
      Col5: 闲(0) 闲(1)
      Col6: 庄(0)
      
    共7列, 13个点
    """
    print("\n" + "="*60)
    print("测试用例3: 混合模式 (含双连+三连)")
    print("="*60)
    
    engine = UnifiedRoadEngine()
    
    results = ["庄", "庄", "闲", "闲", "庄", "庄", "闲", "庄", "庄", "庄", "闲", "闲", "庄"]
    for i, r in enumerate(results, 1):
        five_roads = engine.process_game(i, r)
    
    print(f"\n大路 ({len(five_roads.big_road.points)}点, {five_roads.big_road.max_columns}列x{five_roads.big_road.max_rows}行):")
    for p in five_roads.big_road.points:
        print(f"  列{p.column} 行{p.row}: {p.value} (局{p.game_number})")
    
    for road_name, road in [
        ("大眼仔路", five_roads.big_eye_boy),
        ("小路", five_roads.small_road),
        ("螳螂路", five_roads.cockroach_road),
    ]:
        print(f"\n{road_name} ({len(road.points)}点, {road.max_columns}列x{road.max_rows}行):")
        if not road.points:
            print("  (无数据 — 列数不足，需要至少{['?',1,2,3][['大眼仔路','小路','螳螂路'].index(road_name)]+1}列)")
        else:
            for p in road.points:
                print(f"  列{p.column} 行{p.row}: {p.value} (局{p.game_number})")
    
    return five_roads


def test_case_4_realistic_shoe():
    """
    测试用例4: 接近真实靴的数据序列
    模拟一靴约20局的结果
    """
    print("\n" + "="*60)
    print("测试用例4: 真实靴模拟 (20局)")
    print("="*60)
    
    engine = UnifiedRoadEngine()
    
    # 一个相对真实的随机靴（但不是纯随机，有模式）
    realistic_results = [
        "庄", "庄", "闲", "庄", "闲", "闲", "闲", "庄",
        "庄", "庄", "闲", "庄", "庄", "闲", "闲", "庄",
        "闲", "闲", "庄", "庄",
    ]
    
    for i, r in enumerate(realistic_results, 1):
        five_roads = engine.process_game(i, r)
    
    print(f"\n输入序列({len(realistic_results)}局): {' '.join(realistic_results)}")
    print(f"\n大路: {len(five_roads.big_road.points)}点, {five_roads.big_road.max_columns}列x{five_roads.big_road.max_rows}行")
    
    for road_name, road in [
        ("大眼仔路", five_roads.big_eye_boy),
        ("小路", five_roads.small_road),
        ("螳螂路", five_roads.cockroach_road),
    ]:
        red_count = sum(1 for p in road.points if p.value == "延")
        blue_count = sum(1 for p in road.points if p.value == "转")
        total = len(road.points)
        print(f"\n  {road_name}: {total}点 (红/延={red_count}, 蓝/转={blue_count}), {road.max_columns}列x{road.max_rows}行")
        
        # 显示前10个点的值
        values = [p.value for p in road.points[:10]]
        print(f"    前10值: {' '.join(values)}{'...' if total > 10 else ''}")
    
    return five_roads


def main():
    print("=" * 60)
    print("  百家乐 下三路(Derived Road) 算法验证测试")
    print("  标准: 澳门/拉斯维加斯 奇偶列规则")
    print("=" * 60)
    
    try:
        test_case_1_basic_long_streak()
        test_case_2_choppy_alternating()
        test_case_3_mixed_with_doubles()
        test_case_4_realistic_shoe()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试用例执行完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
