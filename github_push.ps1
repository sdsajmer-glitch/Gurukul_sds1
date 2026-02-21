# github_push.ps1
# This script executes the git commands to initialize and push to the new GitHub repository.

# NOTE: The command 'git add README.md' only adds the README file.
# If you want to push all the files in your project instead, change the line 'git add README.md' to 'git add .'.

git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/developer3technivora-creator/Universepi_Github.git
git push -u origin main
