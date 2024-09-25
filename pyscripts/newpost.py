import shutil, os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import re
import platform
from functools import reduce

DRAFT_SOURCE = r'E:\02_Docs\Obsidian\DhananjayHegde\Blog\Draft'
dest_root = r'E:\01_Dev\11ty\dhananjayhegde\posts'
IMAGE_DEST_ROOT = r'E:\01_Dev\11ty\dhananjayhegde\static\img'
IMAGE_SOURCE = r'E:\02_Docs\Obsidian\DhananjayHegde'
dest_published = r'E:\02_Docs\Obsidian\DhananjayHegde\Blog\Published'

def get_create_modified_date(file_path):    
    """
    Try to get the date that a file was created, falling back to when it was
    last modified if that isn't possible.
    See http://stackoverflow.com/a/39501288/1709587 for explanation.
    """
    if platform.system() == 'Windows':
        return os.path.getctime(file_path)
    else:
        stat = os.stat(file_path)
        try:
            return stat.st_birthtime
        except AttributeError:
            # We're probably on Linux. No easy way to get creation dates here,
            # so we'll settle for when its content was last modified.
            return stat.st_mtime

def make_front_matter(file_content="", title="", file_date=None):
    if not file_date:
        return

    """
    Sample Obsidian Front Matter:
    ---
    excerpt: Learn the basics of software architecture, different aspects of it and what it entails to be an architect
    categories: software-architecture, sap
    hashtags: architecture, availability, foundation, software, testability
    ---
    """
    orig_fm_list = [x for x in filter(lambda t: t, [t for t in file_content.split("---")[1].split("\n")])]
    # fm => key:value
    fm_dict = dict([ tuple( s for s in fm.split(":") ) for fm in orig_fm_list])
    category_string = reduce(lambda x,y: x + "\n  - " + y, fm_dict.get('categories', "").split(","))
    tag_string = reduce(lambda x,y: x + "\n  - " + y, fm_dict.get('hashtags', "").split(","))
    
    eleventy_front_matter = f"""--- \ntitle: {title} \ndate: {file_date.strftime("%Y-%m-%d")} \ncategories:\n  - {category_string}\ntags:\n  - {tag_string}\nexcerpt: {fm_dict['excerpt']} \n------\n"""
    return { 'eleventy': eleventy_front_matter, }

def add_front_matter_to_content(file_content="", eleventy_front_matter=""):
    if not file_content or not eleventy_front_matter:
        return

    """
    ---
    front matter....
    ---
    content...
    """
    orig_content_wo_fm = "---".join(file_content.split("---")[2:])
    return eleventy_front_matter + "\n" + orig_content_wo_fm

def copy_file_to_dest(source_path="", dest_file_name="", dest_root="", modif_date=None, content=""):
    """
    copy file to a folder under /posts like this
    posts/year/month/file_name.md
    """
    if not content or not source_path or not dest_file_name or not dest_root:
        {'source':"", 'destination': ""}
        return
    
    year = modif_date.strftime("%Y")
    month = modif_date.strftime("%m")

    dest_path = f'{dest_root}\{year}\{month}\{dest_file_name}'
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    with open(dest_path, "w") as f:
        f.write(content)
    
    return {'source': source_path, 'destination': dest_path}

def move_to_published(source_path):
    shutil.move(source_path, dest_published)

def prefix_substring(text, substring, prefix):
    """Prefixes a substring with a given string."""

    if substring in text:
        return text.replace(substring, prefix + substring)
    else:
        return text

def copy_images(image_names, images_dest_root, image_source_root, modif_date):    
    year = modif_date.strftime("%Y")
    month = modif_date.strftime("%m")

    image_dest_dir = fr"{images_dest_root}\{year}\{month}"

    for image_name in image_names:
        for orig_image, new_image in image_name.items():
            image_dest_file = f"{image_dest_dir}\\{new_image}"
            image_source_file = f"{image_source_root}\\{orig_image}"

            print(image_dest_file)
            print(image_source_file)

            try:
                os.makedirs(os.path.dirname(image_dest_file), exist_ok=True)
                shutil.copy(image_source_file, image_dest_file)
            except OSError as e:
                print("MAKEDIRS error")
                print(e)

def extract_and_replace_image_names(content, modif_date):
    year = modif_date.strftime("%Y")
    month = modif_date.strftime("%m")
    special_chars = r'[^a-zA-Z0-9\.]'
    
    # image_names = re.findall(r"Pasted image \d+.png", content)
    # new_content = re.sub(r"(?P<original>Pasted image \d+.png)", f"/{year}/{month}/\g<original>", content)
    
    image_names = [{x: re.sub(special_chars, "-", x).lower()} for x in re.findall(r"Pasted image \d+.png", content)]

    print(str(image_names))

    new_content = content

    for image in image_names:
        for key, value in image.items():
            new_content = new_content.replace(f"![[{key}]]", f"![{key}](/static/img/{year}/{month}/{value})")

    return { 'image_names' : image_names, 'content': new_content }
    

def main(source, dest):
    file_found = False
    special_chars = r'[^a-zA-Z0-9\.]'
    
    for folderName, subfolders, filenames in os.walk(source):
        for filename in filenames:
            if re.search(".*\.md", filename):
                print(f'---------------------\n{filename}')
                
                # original file path
                original_file_path = folderName + "\\" + filename
                # original file content
                file_content = open(original_file_path).read()
                # file creation/modified date time
                modif_date_time = get_create_modified_date(original_file_path)
                modif_date = datetime.fromtimestamp(modif_date_time, timezone(offset=timedelta(hours=5.5)))
                
                # Eleventy Front Matter
                fm_11ty_dict = make_front_matter(file_content, filename.split(".md")[0], modif_date)
                content_w_11ty_fm = add_front_matter_to_content(file_content, fm_11ty_dict.get('eleventy', ""))
                
                # Replace image file names with new path name
                enriched_content = extract_and_replace_image_names(content_w_11ty_fm, modif_date)
                
                # Copy markdown file to 11ty/dhananjayhegde/posts/ directory
                new_file_name = re.sub(special_chars, "-", filename.lower())
                result = copy_file_to_dest(original_file_path, new_file_name, dest_root, modif_date, enriched_content['content'])

                # copy images to 11ty/dhananjayhegde/static/img/<yyyy>/<mm>/
                copy_images(enriched_content['image_names'], IMAGE_DEST_ROOT, IMAGE_SOURCE, modif_date)

                # Move original markdown to Published/ folder
                move_to_published(original_file_path)

                print(f"\tCopied to {result['destination']}")
                print(f"\tMoved to {dest_published}")

main(DRAFT_SOURCE, dest_root)
