import shutil, os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import re
import platform
from functools import reduce


POST_ROOT = fr"E:\01_Dev\11ty\dhananjayhegde\posts"
IMAGE_DEST = fr"E:\01_Dev\11ty\dhananjayhegde\static\img"

ident_level = 0

def add_ident():
    global ident_level
    ident_level += 1

def reduce_ident():
    global ident_level
    ident_level -= 1

def replace_image_path_in_posts(post_file, year, month):
    # prefix all image paths with /static/img/<yyyy>/<mm>/
    add_ident()
    print(tabs( ident_level ) + "--> Replacing image paths in post content")
    with open(post_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    if not content:
        print(tabs( ident_level ) + "Could not read post content: {post_file}")
    
    new_content = content
    
    # Replace image paths in post body
    image_names = [x for x in re.findall(r".*/(.*.png)", content)]    
    for image in image_names:
        new_content = re.sub(fr"!\[.*\]\(images/{image}\)", f"![{image}](/static/img/{year}/{month}/{image})", new_content)
    
    with open(post_file, "w", encoding="utf-8") as f:
        f.write(new_content)
        print(tabs( ident_level ) + "<-- Done replacing, exiting")

    reduce_ident()


def copy_images(source_dir, dest_dir):
    add_ident()
    print(tabs( ident_level ) + "--> Copying images to /static/img/")
    for folder_name, subfolders, filenames in os.walk(source_dir):
        for filename in filenames:
            image_dest_file = f"{dest_dir}\\{filename}"
            image_source_file = f"{source_dir}\\{filename}"

            add_ident()
            print(tabs( ident_level ) + f"Source: {image_source_file}")
            print(tabs( ident_level ) + f"Destination {image_dest_file}")            
            reduce_ident()
            
            try:
                os.makedirs(os.path.dirname(image_dest_file), exist_ok=True)
                shutil.copy(image_source_file, image_dest_file)
            except OSError as e:
                print(tabs( ident_level ) + f"MAKEDIRS error: {image_dest_file}")
                print(e)
                print(tabs( ident_level ) + "<-- Errored, exiting without copying")
    
    print(tabs( ident_level ) + "<-- Done copying, exiting")
    reduce_ident()

def tabs(level):
    return "\t" * level

def main(source, dest):    
    for folder_name, subfolders, filenames in os.walk(source):
        for filename in filenames:
            if re.search(".*\.md", filename):
                post_path = f"{folder_name}\{filename}"
                print(tabs( ident_level ) + f"\n--> Migrating images for: {post_path}")
                matches = re.search(r".*(\d{4}).*(\d{2}).*", folder_name)
                year = matches.group(1)
                month = matches.group(2)
                
                image_source_dir = fr"{folder_name}\images"
                image_dest_dir = fr"{IMAGE_DEST}\{year}\{month}"

                copy_images(image_source_dir, image_dest_dir)
                replace_image_path_in_posts(post_path, year, month)
                print(tabs( ident_level ) + "<-- Done, migrating images")
                

main(POST_ROOT, IMAGE_DEST)