@echo off
echo Fixing Git Remote URL...
git remote remove origin
git remote add origin https://github.com/dinosaur-006/AI-Traceable-Intelligent-Breeding.git
echo Remote fixed. Pushing code...
git push -u origin main
pause
