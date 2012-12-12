#!/bin/bash
find . -type d | \
while read directory
do
      #mkdir "${filename%.*}"
      #directory=${filename%.*}
      if [ "$directory" == "./.DS_Store" ]; then
			continue	 
	  fi
	  if [ "$directory" == "./script/.DS_Store" ]; then
			continue	 
	  fi
	  if [ "$directory" == "./script.sh" ]; then
			continue	 
	  fi
	  if [ "$directory" == ".." ]; then
			continue	 
	  fi
	  
 	  if [ "$directory" == "." ]; then
			continue	 
	  fi
	  
	  echo $directory.json $directory.png
 
      TexturePacker --data $directory.json --reduce-border-artifacts --format easaljs --sheet $directory.png $directory/*.png
done