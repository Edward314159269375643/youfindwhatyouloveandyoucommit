import os
from datetime import datetime
from pathlib import Path

VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp'}

def get_file_date(file_path):
    timestamp = os.path.getmtime(file_path)
    return datetime.fromtimestamp(timestamp)

def is_video_file(filename):
    return Path(filename).suffix.lower() in VIDEO_EXTENSIONS

def get_new_filename(file_path, counter=1):
    original_name = Path(file_path).stem
    ext = Path(file_path).suffix.lower()
    date = get_file_date(file_path)
    date_str = date.strftime('%Y%m%d_%H%M%S')

    if counter == 1:
        return f"{date_str}_{original_name}{ext}"
    else:
        return f"{date_str}_{original_name}_{counter}{ext}"

def select_files_by_pattern(video_files):
    print("\n" + "=" * 50)
    print("  文件选择模式")
    print("=" * 50)
    print("1. 全部选择")
    print("2. 按日期范围选择")
    print("3. 按文件名关键词筛选")
    print("4. 手动输入文件名（逗号分隔）")
    print("0. 退出")
    print("-" * 50)

    choice = input("请选择 (0-4): ").strip()

    if choice == '0':
        return []

    if choice == '1':
        return video_files

    if choice == '2':
        start_date = input("开始日期 (YYYY-MM-DD，留空跳过): ").strip()
        end_date = input("结束日期 (YYYY-MM-DD，留空跳过): ").strip()

        filtered = []
        for f in video_files:
            date = get_file_date(f)
            if start_date and date < datetime.strptime(start_date, '%Y-%m-%d'):
                continue
            if end_date and date > datetime.strptime(end_date, '%Y-%m-%d'):
                continue
            filtered.append(f)
        return filtered

    if choice == '3':
        keyword = input("请输入文件名关键词: ").strip()
        return [f for f in video_files if keyword.lower() in f.name.lower()]

    if choice == '4':
        names_input = input("请输入文件名（逗号分隔）: ").strip()
        name_list = [n.strip() for n in names_input.split(',')]
        return [f for f in video_files if f.name in name_list or any(n in f.name for n in name_list)]

    return video_files

def rename_videos(folder_path, dry_run=False):
    folder_path = folder_path.strip()
    
    if not folder_path:
        print("错误：路径不能为空")
        return
    
    folder = Path(folder_path)
    
    print(f"\n正在检查路径: {folder_path}")
    print(f"规范化路径: {folder.resolve()}")
    
    if not folder.exists():
        print(f"错误：文件夹不存在")
        print(f"当前工作目录: {os.getcwd()}")
        print("提示：")
        print("  1. 确保路径拼写正确")
        print("  2. 使用绝对路径，如: D:\\videos\\vacation")
        print("  3. 路径中不要包含引号")
        print("  4. 如果路径有空格，请直接输入，不需要加引号")
        return
    
    if not folder.is_dir():
        print("错误：指定的路径不是文件夹")
        return

    video_files = [f for f in folder.iterdir() if f.is_file() and is_video_file(f.name)]
    if not video_files:
        print("文件夹中没有找到视频文件")
        print(f"支持的格式: {', '.join(sorted(VIDEO_EXTENSIONS))}")
        return

    selected_files = select_files_by_pattern(video_files)
    if not selected_files:
        print("没有选中任何文件")
        return

    skipped_count = len(video_files) - len(selected_files)
    print(f"\n将处理 {len(selected_files)} 个文件，跳过 {skipped_count} 个文件\n")

    confirm = input("确认重命名？(y/n): ").strip().lower()
    if confirm != 'y':
        print("已取消")
        return

    counter_dict = {}
    renamed_count = 0

    for file_path in selected_files:
        if file_path.name.startswith('20') and len(file_path.name) >= 8:
            skipped_count += 1
            continue

        counter_key = file_path.stem.rsplit('_', 1)[0] if '_' in file_path.stem else file_path.stem
        counter_dict[counter_key] = counter_dict.get(counter_key, 0) + 1

        new_name = get_new_filename(file_path, counter_dict[counter_key])
        new_path = folder / new_name

        if new_path.exists() and new_path != file_path:
            base = Path(new_path).stem
            ext = Path(new_path).suffix
            suffix = 1
            while new_path.exists():
                new_name = f"{base}_{suffix}{ext}"
                new_path = folder / new_name
                suffix += 1

        if dry_run:
            print(f"[预览] {file_path.name} -> {new_name}")
        else:
            file_path.rename(new_path)
            print(f"已重命名: {file_path.name} -> {new_name}")

        renamed_count += 1

    print(f"\n完成！成功处理 {renamed_count} 个文件，跳过 {skipped_count} 个文件")

if __name__ == '__main__':
    import sys

    print("=" * 50)
    print("  视频批量按日期重命名工具")
    print("=" * 50)
    print("\n使用说明:")
    print("  - 输入文件夹路径，如: D:\\videos\\vacation")
    print("  - 路径不需要加引号")
    print("  - 支持相对路径和绝对路径")
    print()

    folder = input("请输入视频文件夹路径: ").strip()
    if not folder:
        print("未输入路径，程序退出")
        sys.exit(0)

    mode = input("是否仅预览（不实际重命名）？ (y/n, 默认n): ").strip().lower()
    dry_run = mode == 'y'

    print(f"\n{'预览模式' if dry_run else '执行模式'} - 开始处理...")
    rename_videos(folder, dry_run=dry_run)