#!/bin/bash
#arr=() 
#i=0
find . -name "*.png" | \
while read filename
do
 
      directory=${filename%.*}
      directory=${directory:2:9999}
      if [ "$filename" == "./.DS_Store" ]; then
			continue	 
	  fi
	  if [ "$filename" == "./script/.DS_Store" ]; then
			continue	 
	  fi
	  if [ "$filename" == "./script.sh" ]; then
			continue	 
	  fi
	  if [ "$filename" == ".." ]; then
			continue	 
	  fi
	  
 	  if [ "$filename" == "." ]; then
			continue	 
	  fi
	  #echo $filename
	  echo "'"$directory"'", 
	  #directory = "'"$directory"'"
 
      #TexturePacker --data $directory.json --reduce-border-artifacts --format easaljs --sheet $directory.png $directory/*.png
done
 