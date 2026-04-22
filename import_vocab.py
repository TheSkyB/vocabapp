#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词汇导入脚本
将 vocabulary 目录的 txt 词库转换为 App 使用的 JS 格式
"""

import os
import re
from pathlib import Path

# 词库配置
BOOKS_CONFIG = {
    '1 初中-乱序.txt': {'key': 'chuzhong', 'name': '初中词汇'},
    '2 高中-乱序.txt': {'key': 'gaozhong', 'name': '高中词汇'},
    '3 四级-乱序.txt': {'key': 'cet4', 'name': 'CET-4 词汇'},
    '4 六级-乱序.txt': {'key': 'cet6', 'name': 'CET-6 词汇'},
    '5 考研-乱序.txt': {'key': 'kaoyan', 'name': '考研词汇'},
    '6 托福-乱序.txt': {'key': 'toefl', 'name': 'TOEFL 词汇'},
    '7 SAT-乱序.txt': {'key': 'sat', 'name': 'SAT 词汇'},
}

def parse_line(line):
    """解析一行词汇"""
    line = line.strip()
    if not line:
        return None
    
    # 支持 tab 和多个空格分隔
    if '\t' in line:
        parts = line.split('\t')
    else:
        parts = re.split(r'\s{2,}', line)
    
    if len(parts) < 2:
        return None
    
    word = parts[0].strip()
    meaning = parts[1].strip()
    
    # 提取词性
    pos_match = re.match(r'^(n\.?|v\.?|adj\.?|adv\.?|pron\.?|prep\.?|conj\.?|interj\.?|num\.?|det\.?|aux\.?|art\.?)(.+)', meaning, re.IGNORECASE)
    if pos_match:
        pos = pos_match.group(1).replace('.', '').lower()
        pos_display = pos_match.group(1)
        definition = pos_match.group(2).strip()
        # 去掉开头的逗号或空格
        definition = re.sub(r'^[,，]\s*', '', definition)
        meaning = f"{pos_display} {definition}"
    else:
        pos = ''
        pos_display = ''
    
    # 提取音标 (如果有)
    phonetic = ''
    
    return {
        'w': word.lower(),
        'p': phonetic,
        'pk': pos,  # 词性 key
        'm': meaning,
        'e': '',  # 例句
        'et': '',  # 例句翻译
        's': [],  # 同义词
        'a': [],  # 反义词
        'r': ''   # 词根
    }

def convert_file(filepath, book_key):
    """转换单个文件"""
    words = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            parsed = parse_line(line)
            if parsed:
                words.append(parsed)
    return words

def generate_js(all_words, books_info):
    """生成 JS 文件"""
    from datetime import datetime
    
    # 词库元信息
    books_meta = "var WORD_BOOKS = {\n"
    for key, info in books_info.items():
        count = len(all_words.get(key, []))
        books_meta += f"  {key}: {{ name: '{info['name']}', desc: '{count}词' }},\n"
    books_meta += "};\n\n"
    
    # 词汇数据
    words_data = "var WORDS = {\n"
    for key, word_list in all_words.items():
        words_data += f"  {key}: [\n"
        for w in word_list:
            words_data += f"    {{w:'{w['w']}',p:'{w['p']}',pk:'{w['pk']}',m:'{w['m']}',e:'{w['e']}',et:'{w['et']}',s:{w['s']},a:{w['a']},r:'{w['r']}'}},\n"
        words_data += "  ],\n"
    words_data += "};\n"
    
    header = f"""// === 词汇数据库（自动生成）===
// 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// 来源: vocabulary 目录

"""
    return header + books_meta + words_data

def main():
    # 直接使用绝对路径
    vocab_dir = Path(r'C:\Users\TheSky\Desktop\Code\vocabulary')
    output_file = Path(__file__).parent / 'web' / 'js' / 'words.js'
    
    print(f"Vocab dir: {vocab_dir}")
    print(f"Output: {output_file}")
    print("-" * 50)
    
    all_words = {}
    books_info = {}
    
    for filename, config in BOOKS_CONFIG.items():
        filepath = vocab_dir / filename
        if not filepath.exists():
            print(f"[WARN] Not found: {filename}")
            continue
        
        words = convert_file(filepath, config['key'])
        all_words[config['key']] = words
        books_info[config['key']] = {'name': config['name']}
        
        print(f"[OK] {config['name']}: {len(words)} words")
    
    # 生成 JS
    js_content = generate_js(all_words, books_info)
    
    # 写入文件
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    total = sum(len(w) for w in all_words.values())
    print("-" * 50)
    print(f"[DONE] {len(all_words)} books, {total} words total")
    print(f"[OUT] {output_file}")

if __name__ == '__main__':
    main()
