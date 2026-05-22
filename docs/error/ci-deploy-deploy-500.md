2026-05-22T10:18:48.4315718Z asustor-runner(version:v0.4.0) received task 500 of job deploy, be triggered by event: push
2026-05-22T10:18:48.4320847Z workflow prepared
2026-05-22T10:18:48.4321739Z evaluating expression 'success()'
2026-05-22T10:18:48.4322689Z expression 'success()' evaluated to 'true'
2026-05-22T10:18:48.4322875Z 'runs-on' key not defined in CI / CD Pipeline/build
2026-05-22T10:18:48.4323291Z No steps found
2026-05-22T10:18:48.4324213Z evaluating expression 'github.ref == 'refs/heads/main''
2026-05-22T10:18:48.4324899Z expression 'github.ref == 'refs/heads/main'' evaluated to 'true'
2026-05-22T10:18:48.4325190Z 🚀  Start image=node:18-bullseye
2026-05-22T10:18:48.4427516Z   🐳  docker pull image=node:18-bullseye platform= username= forcePull=false
2026-05-22T10:18:48.4427846Z   🐳  docker pull node:18-bullseye
2026-05-22T10:18:48.4448266Z Image exists? true
2026-05-22T10:18:48.4514454Z   🐳  docker create image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-22T10:19:01.9808283Z Created container name=GITEA-ACTIONS-TASK-500_WORKFLOW-CI-CD-Pipeline_JOB-deploy id=01e4a727333d4c4537456a6cf1c4cb5756fea90f93313931fbf1d1185da90a0a from image node:18-bullseye (platform: )
2026-05-22T10:19:01.9808818Z ENV ==> [RUNNER_TOOL_CACHE=/opt/hostedtoolcache RUNNER_OS=Linux RUNNER_ARCH=X64 RUNNER_TEMP=/tmp LANG=C.UTF-8]
2026-05-22T10:19:01.9809022Z   🐳  docker run image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-22T10:19:01.9809255Z Starting container: 01e4a727333d4c4537456a6cf1c4cb5756fea90f93313931fbf1d1185da90a0a
2026-05-22T10:19:03.5852096Z Started container: 01e4a727333d4c4537456a6cf1c4cb5756fea90f93313931fbf1d1185da90a0a
2026-05-22T10:19:03.7428626Z Writing entry to tarball workflow/event.json len:15983
2026-05-22T10:19:03.7429505Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T10:19:03.7429748Z Extracting content to '/var/run/act/'
2026-05-22T10:19:03.7677546Z   ☁  git clone 'https://github.com/actions/checkout' # ref=v4
2026-05-22T10:19:03.7678088Z   cloning https://github.com/actions/checkout to /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T10:19:05.0968215Z Non-terminating error while running 'git clone': some refs were not updated
2026-05-22T10:19:05.1337978Z evaluating expression ''
2026-05-22T10:19:05.1338984Z expression '' evaluated to 'true'
2026-05-22T10:19:05.1339218Z ⭐ Run Main  Checkout
2026-05-22T10:19:05.1339638Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-22T10:19:05.1339964Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-22T10:19:05.1340299Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-22T10:19:05.1340543Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T10:19:05.1340773Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-22T10:19:05.1341098Z Extracting content to '/var/run/act'
2026-05-22T10:19:05.1478810Z expression '${{ github.token }}' rewritten to 'format('{0}', github.token)'
2026-05-22T10:19:05.1479336Z evaluating expression 'format('{0}', github.token)'
2026-05-22T10:19:05.1480021Z expression 'format('{0}', github.token)' evaluated to '%!t(string=***)'
2026-05-22T10:19:05.1481107Z expression '${{ github.repository }}' rewritten to 'format('{0}', github.repository)'
2026-05-22T10:19:05.1481292Z evaluating expression 'format('{0}', github.repository)'
2026-05-22T10:19:05.1481695Z expression 'format('{0}', github.repository)' evaluated to '%!t(string=np-dms/lcbp3)'
2026-05-22T10:19:05.1482003Z type=remote-action actionDir=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab actionPath= workdir=/workspace/np-dms/lcbp3 actionCacheDir=/root/.cache/act actionName=c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab containerActionDir=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T10:19:05.1482336Z /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T10:19:05.1482733Z   🐳  docker cp src=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ dst=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T10:19:05.1485097Z Writing tarball /tmp/act2920164473 from /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T10:19:05.1485370Z Stripping prefix:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ src:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T10:19:05.3476755Z Extracting content from '/tmp/act2920164473' to '/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/'
2026-05-22T10:19:05.6570052Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-22T10:19:05.6570795Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-22T10:19:05.6571062Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-22T10:19:05.6571770Z Working directory '/workspace/np-dms/lcbp3'
2026-05-22T10:19:05.9554092Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-22T10:19:05.9554429Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-22T10:19:05.9562431Z Syncing repository: np-dms/lcbp3
2026-05-22T10:19:05.9573824Z ::group::Getting Git version info
2026-05-22T10:19:05.9574213Z Working directory is '/workspace/np-dms/lcbp3'
2026-05-22T10:19:05.9641179Z [command]/usr/bin/git version
2026-05-22T10:19:05.9715168Z git version 2.30.2
2026-05-22T10:19:05.9765082Z ::endgroup::
2026-05-22T10:19:05.9792890Z Temporarily overriding HOME='/tmp/faa3f81d-ef7a-4313-ba68-519e4afd0bc1' before making global git config changes
2026-05-22T10:19:05.9793661Z Adding repository directory to the temporary git global config as a safe directory
2026-05-22T10:19:05.9806815Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-22T10:19:05.9886442Z Deleting the contents of '/workspace/np-dms/lcbp3'
2026-05-22T10:19:05.9891922Z ::group::Initializing the repository
2026-05-22T10:19:05.9901572Z [command]/usr/bin/git init /workspace/np-dms/lcbp3
2026-05-22T10:19:05.9968811Z hint: Using 'master' as the name for the initial branch. This default branch name
2026-05-22T10:19:05.9969549Z hint: is subject to change. To configure the initial branch name to use in all
2026-05-22T10:19:05.9969773Z hint: of your new repositories, which will suppress this warning, call:
2026-05-22T10:19:05.9970102Z hint: 
2026-05-22T10:19:05.9970288Z hint: 	git config --global init.defaultBranch <name>
2026-05-22T10:19:05.9970473Z hint: 
2026-05-22T10:19:05.9970675Z hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
2026-05-22T10:19:05.9970970Z hint: 'development'. The just-created branch can be renamed via this command:
2026-05-22T10:19:05.9971177Z hint: 
2026-05-22T10:19:05.9971349Z hint: 	git branch -m <name>
2026-05-22T10:19:05.9979437Z Initialized empty Git repository in /workspace/np-dms/lcbp3/.git/
2026-05-22T10:19:06.0000579Z [command]/usr/bin/git remote add origin https://git.np-dms.work/np-dms/lcbp3
2026-05-22T10:19:06.0071725Z ::endgroup::
2026-05-22T10:19:06.0072281Z ::group::Disabling automatic garbage collection
2026-05-22T10:19:06.0079319Z [command]/usr/bin/git config --local gc.auto 0
2026-05-22T10:19:06.0141230Z ::endgroup::
2026-05-22T10:19:06.0141683Z ::group::Setting up auth
2026-05-22T10:19:06.0155782Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-22T10:19:06.0219410Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-22T10:19:06.0720273Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-22T10:19:06.0783662Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-22T10:19:06.1311160Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-22T10:19:06.1382815Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-22T10:19:06.1880932Z [command]/usr/bin/git config --local http.https://git.np-dms.work/.extraheader AUTHORIZATION: basic ***
2026-05-22T10:19:06.1975055Z ::endgroup::
2026-05-22T10:19:06.1975537Z ::group::Fetching the repository
2026-05-22T10:19:06.1990073Z [command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +942cda486c3ed3e119553a8521db6653f0fd9203:refs/remotes/origin/main
2026-05-22T10:19:08.9700043Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-22T10:19:08.9700737Z  * [new ref]         942cda486c3ed3e119553a8521db6653f0fd9203 -> origin/main
2026-05-22T10:19:08.9745012Z ::endgroup::
2026-05-22T10:19:08.9745437Z ::group::Determining the checkout info
2026-05-22T10:19:08.9748632Z ::endgroup::
2026-05-22T10:19:08.9757160Z [command]/usr/bin/git sparse-checkout disable
2026-05-22T10:19:08.9832014Z [command]/usr/bin/git config --local --unset-all extensions.worktreeConfig
2026-05-22T10:19:08.9891632Z ::group::Checking out the ref
2026-05-22T10:19:08.9900810Z [command]/usr/bin/git checkout --progress --force -B main refs/remotes/origin/main
2026-05-22T10:19:09.3640064Z Switched to a new branch 'main'
2026-05-22T10:19:09.3640912Z Branch 'main' set up to track remote branch 'main' from 'origin'.
2026-05-22T10:19:09.3667049Z ::endgroup::
2026-05-22T10:19:09.3740599Z [command]/usr/bin/git log -1 --format=%H
2026-05-22T10:19:09.3793626Z 942cda486c3ed3e119553a8521db6653f0fd9203
2026-05-22T10:19:09.3822908Z ::remove-matcher owner=checkout-git::
2026-05-22T10:19:10.4042405Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-22T10:19:10.4043442Z  * branch              main       -> FETCH_HEAD
2026-05-22T10:19:10.4048673Z    990d80e1..942cda48  main       -> origin/main
2026-05-22T10:19:10.4896174Z HEAD is now at 942cda48 feat(migration): merge ADR-028 migration architecture refactor into main
2026-05-22T10:19:10.4933958Z =========================================
2026-05-22T10:19:10.4934699Z LCBP3-DMS Deployment v2.0
2026-05-22T10:19:10.4934901Z =========================================
2026-05-22T10:19:10.5438678Z [1/3] Building Docker images (parallel)...
2026-05-22T10:19:11.8369913Z #0 building with "default" instance using docker driver
2026-05-22T10:19:11.8370631Z 
2026-05-22T10:19:11.8370857Z #1 [internal] load build definition from Dockerfile
2026-05-22T10:19:11.8371109Z #1 transferring dockerfile:
2026-05-22T10:19:11.8587796Z #0 building with "default" instance using docker driver
2026-05-22T10:19:11.8588541Z 
2026-05-22T10:19:11.8588755Z #1 [internal] load build definition from Dockerfile
2026-05-22T10:19:11.8588957Z #1 transferring dockerfile: 5.15kB done
2026-05-22T10:19:11.9671597Z #1 DONE 0.3s
2026-05-22T10:19:11.9926008Z #1 transferring dockerfile: 3.28kB done
2026-05-22T10:19:12.1201383Z 
2026-05-22T10:19:12.1202051Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-22T10:19:12.2718788Z #1 DONE 0.6s
2026-05-22T10:19:12.4839841Z 
2026-05-22T10:19:12.4840529Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-22T10:19:14.0802984Z #2 DONE 1.7s
2026-05-22T10:19:14.0803800Z #2 DONE 2.0s
2026-05-22T10:19:14.2009974Z 
2026-05-22T10:19:14.2010725Z #3 [internal] load .dockerignore
2026-05-22T10:19:14.2010957Z #3 transferring context:
2026-05-22T10:19:14.3004915Z 
2026-05-22T10:19:14.3005599Z #3 [internal] load .dockerignore
2026-05-22T10:19:14.3005872Z #3 transferring context: 1.12kB done
2026-05-22T10:19:14.3549801Z #3 transferring context: 1.12kB done
2026-05-22T10:19:15.4343660Z #3 DONE 1.3s
2026-05-22T10:19:15.6357838Z 
2026-05-22T10:19:15.6358635Z #4 [internal] load build context
2026-05-22T10:19:15.6358881Z #4 DONE 0.0s
2026-05-22T10:19:15.6359512Z 
2026-05-22T10:19:15.6359799Z #5 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T10:19:15.6360113Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T10:19:15.8377033Z #3 DONE 1.7s
2026-05-22T10:19:15.9656694Z 
2026-05-22T10:19:15.9657446Z #4 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T10:19:15.9657750Z #4 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T10:19:16.1179243Z #4 ...
2026-05-22T10:19:16.1179933Z 
2026-05-22T10:19:16.1180128Z #5 [internal] load build context
2026-05-22T10:19:16.1180315Z #5 DONE 0.0s
2026-05-22T10:19:16.2670592Z 
2026-05-22T10:19:16.2671437Z #4 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T10:19:16.3617728Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.9s done
2026-05-22T10:19:16.3618499Z #4 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.9s done
2026-05-22T10:19:16.5150877Z #4 DONE 0.9s
2026-05-22T10:19:16.5152014Z 
2026-05-22T10:19:16.5152210Z #5 [internal] load build context
2026-05-22T10:19:16.5786806Z #5 DONE 0.9s
2026-05-22T10:19:16.5787687Z 
2026-05-22T10:19:16.5788060Z #4 [internal] load build context
2026-05-22T10:19:17.4412587Z #4 transferring context: 3.00MB 0.9s done
2026-05-22T10:19:17.4623884Z #5 transferring context: 3.15MB 0.8s done
2026-05-22T10:19:17.7170773Z #4 DONE 1.4s
2026-05-22T10:19:17.9688556Z 
2026-05-22T10:19:17.9689375Z #6 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-22T10:19:17.9689681Z #6 CACHED
2026-05-22T10:19:17.9689851Z 
2026-05-22T10:19:17.9690016Z #7 [deps 3/6] WORKDIR /w
2026-05-22T10:19:18.0104613Z #5 DONE 1.6s
2026-05-22T10:19:18.1228204Z 
2026-05-22T10:19:18.1228899Z #6 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-22T10:19:18.1229171Z #6 CACHED
2026-05-22T10:19:18.1229427Z 
2026-05-22T10:19:18.1229681Z #7 [deps 3/6] WORKDIR /app
2026-05-22T10:19:18.1621411Z #7 CACHED
2026-05-22T10:19:18.1622308Z 
2026-05-22T10:19:18.1622578Z #8 [build  2/14] RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
2026-05-22T10:19:18.1622837Z #8 CACHED
2026-05-22T10:19:18.1623070Z 
2026-05-22T10:19:18.1623345Z #9 [build  3/14] WORKDIR /w
2026-05-22T10:19:18.1623575Z #9 CACHED
2026-05-22T10:19:18.1623738Z 
2026-05-22T10:19:18.1623896Z #10 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:18.2731750Z #7 CACHED
2026-05-22T10:19:18.2732449Z 
2026-05-22T10:19:18.2732643Z #8 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:18.3072969Z #8 ...
2026-05-22T10:19:18.3073812Z 
2026-05-22T10:19:18.3074045Z #9 [build  2/14] RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
2026-05-22T10:19:18.3074330Z #9 CACHED
2026-05-22T10:19:18.4579481Z 
2026-05-22T10:19:18.4580151Z #10 [build  3/10] WORKDIR /app
2026-05-22T10:19:18.4580373Z #10 CACHED
2026-05-22T10:19:18.4580540Z 
2026-05-22T10:19:18.4580703Z #11 [build  4/10] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:24.7720083Z #10 DONE 6.8s
2026-05-22T10:19:24.7720811Z 
2026-05-22T10:19:24.7720998Z #11 [build  4/14] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:25.3535498Z #11 ...
2026-05-22T10:19:25.3536162Z 
2026-05-22T10:19:25.3536348Z #12 [deps 5/6] COPY frontend/package.json ./frontend/
2026-05-22T10:19:25.8510239Z #12 ...
2026-05-22T10:19:25.8510930Z 
2026-05-22T10:19:25.8511130Z #11 [build  4/14] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:25.8511361Z #11 DONE 7.8s
2026-05-22T10:19:26.0013259Z 
2026-05-22T10:19:26.0014031Z #12 [deps 5/6] COPY frontend/package.json ./frontend/
2026-05-22T10:19:26.5752036Z #11 ...
2026-05-22T10:19:26.5752810Z 
2026-05-22T10:19:26.5753013Z #8 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:26.5753549Z #8 DONE 8.5s
2026-05-22T10:19:26.7261362Z 
2026-05-22T10:19:26.7262475Z #11 [build  4/10] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:26.8314076Z #11 ...
2026-05-22T10:19:26.8314808Z 
2026-05-22T10:19:26.8314999Z #12 [deps 5/6] COPY backend/package.json ./backend/
2026-05-22T10:19:27.2926932Z #12 ...
2026-05-22T10:19:27.2927706Z 
2026-05-22T10:19:27.2927901Z #11 [build  4/10] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T10:19:27.2928343Z #11 DONE 9.0s
2026-05-22T10:19:27.4430489Z 
2026-05-22T10:19:27.4431155Z #12 [deps 5/6] COPY backend/package.json ./backend/
2026-05-22T10:19:29.1724689Z #12 DONE 3.8s
2026-05-22T10:19:29.3783444Z 
2026-05-22T10:19:29.3784139Z #13 [deps 6/6] RUN pnpm install --frozen-lockfile --ignore-scripts --filter lcbp3-frontend...
2026-05-22T10:19:29.6366874Z #12 DONE 2.8s
2026-05-22T10:19:29.8717901Z 
2026-05-22T10:19:29.8718656Z #13 [deps 6/6] RUN pnpm install --frozen-lockfile --filter backend...
2026-05-22T10:19:35.0260248Z #13 5.305 Lockfile is up to date, resolution step is skipped
2026-05-22T10:19:35.0263791Z #13 5.648 Lockfile is up to date, resolution step is skipped
2026-05-22T10:19:35.2099087Z #13 5.488 Progress: resolved 1, reused 0, downloaded 0, added 0
2026-05-22T10:19:35.2726181Z #13 5.894 Progress: resolved 1, reused 0, downloaded 0, added 0
2026-05-22T10:19:35.7910405Z #13 6.413 .                                        | +711 ++++++++++++++++++++++++++++++++
2026-05-22T10:19:35.8277889Z #13 6.106 .                                        |    +1***6 ++++++++++++++++++++++++++++
2026-05-22T10:19:36.2311095Z #13 6.509 Progress: resolved 1***6, reused 0, downloaded 9, added 0
2026-05-22T10:19:36.2757332Z #13 6.897 Progress: resolved 711, reused 0, downloaded 1, added 0
2026-05-22T10:19:36.7221975Z #13 7.344 
2026-05-22T10:19:36.7222696Z #13 7.344    ╭──────────────────────────────────────────────╮
2026-05-22T10:19:36.7223049Z #13 7.344    │                                              │
2026-05-22T10:19:36.7223498Z #13 7.344    │     Update available! 10.33.0 → 11.2.2.      │
2026-05-22T10:19:36.7223866Z #13 7.344    │     Changelog: https://pnpm.io/v/11.2.2      │
2026-05-22T10:19:36.7224065Z #13 7.344    │   To update, run: corepack use pnpm@11.2.2   │
2026-05-22T10:19:36.7224261Z #13 7.344    │                                              │
2026-05-22T10:19:36.7224466Z #13 7.344    ╰──────────────────────────────────────────────╯
2026-05-22T10:19:36.7224784Z #13 7.344 
2026-05-22T10:19:37.2310963Z #13 7.509 Progress: resolved 1***6, reused 0, downloaded ***, added 0
2026-05-22T10:19:37.2772908Z #13 7.898 Progress: resolved 711, reused 0, downloaded 57, added 57
2026-05-22T10:19:37.4459068Z #13 7.574 
2026-05-22T10:19:37.4459784Z #13 7.574    ╭──────────────────────────────────────────────╮
2026-05-22T10:19:37.4460053Z #13 7.574    │                                              │
2026-05-22T10:19:37.4460246Z #13 7.574    │     Update available! 10.33.0 → 11.2.2.      │
2026-05-22T10:19:37.4460469Z #13 7.574    │     Changelog: https://pnpm.io/v/11.2.2      │
2026-05-22T10:19:37.4460817Z #13 7.574    │   To update, run: corepack use pnpm@11.2.2   │
2026-05-22T10:19:37.4461024Z #13 7.574    │                                              │
2026-05-22T10:19:37.4461266Z #13 7.574    ╰──────────────────────────────────────────────╯
2026-05-22T10:19:37.4461589Z #13 7.574 
2026-05-22T10:19:38.2322647Z #13 8.511 Progress: resolved 1***6, reused 0, downloaded 27, added 0
2026-05-22T10:19:38.2756946Z #13 8.897 Progress: resolved 711, reused 0, downloaded 92, added 73
2026-05-22T10:19:39.2322172Z #13 9.511 Progress: resolved 1***6, reused 0, downloaded 34, added 0
2026-05-22T10:19:39.2760286Z #13 9.898 Progress: resolved 711, reused 0, downloaded 101, added 77
2026-05-22T10:19:40.2324016Z #13 10.51 Progress: resolved 1***6, reused 0, downloaded 52, added 4
2026-05-22T10:19:40.2757616Z #13 10.90 Progress: resolved 711, reused 0, downloaded 117, added 83
2026-05-22T10:19:41.2329014Z #13 11.51 Progress: resolved 1***6, reused 0, downloaded 92, added 18
2026-05-22T10:19:41.2760154Z #13 11.90 Progress: resolved 711, reused 0, downloaded 144, added 96
2026-05-22T10:19:42.2327756Z #13 12.51 Progress: resolved 1***6, reused 0, downloaded 153, added 35
2026-05-22T10:19:42.2762488Z #13 12.90 Progress: resolved 711, reused 0, downloaded 154, added 101
2026-05-22T10:19:43.2337553Z #13 13.51 Progress: resolved 1***6, reused 0, downloaded 202, added 57
2026-05-22T10:19:43.2763987Z #13 13.90 Progress: resolved 711, reused 0, downloaded 170, added 110
2026-05-22T10:19:43.6501704Z #13 13.93  WARN  Tarball download average speed 35 KiB/s (size 38 KiB) is below 50 KiB/s: https://registry.npmjs.org/engine.io/-/engine.io-6.6.4.tgz (GET)
2026-05-22T10:19:44.2342885Z #13 14.51 Progress: resolved 1***6, reused 0, downloaded 239, added 72
2026-05-22T10:19:44.2762266Z #13 14.90 Progress: resolved 711, reused 0, downloaded 193, added 145
2026-05-22T10:19:45.2344610Z #13 15.51 Progress: resolved 1***6, reused 0, downloaded 259, added 84
2026-05-22T10:19:45.2762943Z #13 15.90 Progress: resolved 711, reused 0, downloaded 210, added 158
2026-05-22T10:19:45.4809362Z #13 16.10  WARN  Tarball download average speed 37 KiB/s (size 121 KiB) is below 50 KiB/s: https://registry.npmjs.org/file-selector/-/file-selector-2.1.2.tgz (GET)
2026-05-22T10:19:46.2349323Z #13 16.51 Progress: resolved 1***6, reused 0, downloaded 299, added 130
2026-05-22T10:19:46.2794198Z #13 16.90 Progress: resolved 711, reused 0, downloaded 239, added 179
2026-05-22T10:19:47.2354449Z #13 17.51 Progress: resolved 1***6, reused 0, downloaded 310, added 141
2026-05-22T10:19:47.2788949Z #13 17.90 Progress: resolved 711, reused 0, downloaded 273, added 209
2026-05-22T10:19:48.2353392Z #13 18.51 Progress: resolved 1***6, reused 0, downloaded 313, added 143
2026-05-22T10:19:48.2813069Z #13 18.90 Progress: resolved 711, reused 0, downloaded 280, added 213
2026-05-22T10:19:49.1387759Z #13 19.76  WARN  GET https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.55.1.tgz error (ECONNRESET). Will retry in 10 seconds. 2 retries left.
2026-05-22T10:19:49.2354539Z #13 19.51 Progress: resolved 1***6, reused 0, downloaded 316, added 145
2026-05-22T10:19:49.2793124Z #13 19.90 Progress: resolved 711, reused 0, downloaded 292, added ***1
2026-05-22T10:19:50.2788236Z #13 20.90 Progress: resolved 711, reused 0, downloaded 293, added ***2
2026-05-22T10:19:51.2582178Z #13 21.54 Progress: resolved 1***6, reused 0, downloaded 317, added 145
2026-05-22T10:19:51.2804748Z #13 21.90 Progress: resolved 711, reused 0, downloaded 302, added ***5
2026-05-22T10:19:52.2597995Z #13 ***.54 Progress: resolved 1***6, reused 0, downloaded 318, added 145
2026-05-22T10:19:52.2801842Z #13 ***.90 Progress: resolved 711, reused 0, downloaded 321, added 236
2026-05-22T10:19:53.2601408Z #13 23.54 Progress: resolved 1***6, reused 0, downloaded 321, added 145
2026-05-22T10:19:53.2801226Z #13 23.90 Progress: resolved 711, reused 0, downloaded 337, added 244
2026-05-22T10:19:54.2609797Z #13 24.54 Progress: resolved 1***6, reused 0, downloaded 336, added 151
2026-05-22T10:19:54.2807672Z #13 24.90 Progress: resolved 711, reused 0, downloaded 340, added 244
2026-05-22T10:19:55.2622139Z #13 25.54 Progress: resolved 1***6, reused 0, downloaded 338, added 151
2026-05-22T10:19:55.2801726Z #13 25.90 Progress: resolved 711, reused 0, downloaded 344, added 248
2026-05-22T10:19:56.2620958Z #13 26.54 Progress: resolved 1***6, reused 0, downloaded 350, added 155
2026-05-22T10:19:56.2856855Z #13 26.91 Progress: resolved 711, reused 0, downloaded 345, added 248
2026-05-22T10:19:57.2623713Z #13 27.54 Progress: resolved 1***6, reused 0, downloaded 354, added 159
2026-05-22T10:19:57.2799278Z #13 27.90 Progress: resolved 711, reused 0, downloaded 346, added 248
2026-05-22T10:19:58.2628712Z #13 28.54 Progress: resolved 1***6, reused 0, downloaded 390, added 256
2026-05-22T10:19:58.2810112Z #13 28.90 Progress: resolved 711, reused 0, downloaded 383, added 260
2026-05-22T10:19:59.2642586Z #13 29.54 Progress: resolved 1***6, reused 0, downloaded 451, added 291
2026-05-22T10:19:59.2800216Z #13 29.90 Progress: resolved 711, reused 0, downloaded 433, added 294
2026-05-22T10:20:00.2643872Z #13 30.54 Progress: resolved 1***6, reused 0, downloaded 488, added 306
2026-05-22T10:20:00.2802889Z #13 30.90 Progress: resolved 711, reused 0, downloaded 467, added 351
2026-05-22T10:20:01.2650883Z #13 31.54 Progress: resolved 1***6, reused 0, downloaded 510, added 314
2026-05-22T10:20:01.2810760Z #13 31.90 Progress: resolved 711, reused 0, downloaded 526, added 417
2026-05-22T10:20:02.2650003Z #13 32.54 Progress: resolved 1***6, reused 0, downloaded 537, added 3***
2026-05-22T10:20:02.2811920Z #13 32.90 Progress: resolved 711, reused 0, downloaded 550, added 429
2026-05-22T10:20:03.2655918Z #13 33.54 Progress: resolved 1***6, reused 0, downloaded 549, added 323
2026-05-22T10:20:03.2816464Z #13 33.90 Progress: resolved 711, reused 0, downloaded 573, added 436
2026-05-22T10:20:04.2661276Z #13 34.54 Progress: resolved 1***6, reused 0, downloaded 587, added 332
2026-05-22T10:20:04.2812639Z #13 34.90 Progress: resolved 711, reused 0, downloaded 613, added 453
2026-05-22T10:20:05.2658735Z #13 35.54 Progress: resolved 1***6, reused 0, downloaded 645, added 346
2026-05-22T10:20:05.2814764Z #13 35.90 Progress: resolved 711, reused 0, downloaded 626, added 459
2026-05-22T10:20:06.2660245Z #13 36.54 Progress: resolved 1***6, reused 0, downloaded 689, added 364
2026-05-22T10:20:06.2820776Z #13 36.90 Progress: resolved 711, reused 0, downloaded 673, added 474
2026-05-22T10:20:07.2664642Z #13 37.54 Progress: resolved 1***6, reused 0, downloaded 720, added 377
2026-05-22T10:20:07.2831944Z #13 37.90 Progress: resolved 711, reused 0, downloaded 690, added 487
2026-05-22T10:20:08.2664357Z #13 38.54 Progress: resolved 1***6, reused 0, downloaded 760, added 395
2026-05-22T10:20:08.2856390Z #13 38.91 Progress: resolved 711, reused 0, downloaded 704, added 553
2026-05-22T10:20:09.2661825Z #13 39.54 Progress: resolved 1***6, reused 0, downloaded 772, added 403
2026-05-22T10:20:09.2853454Z #13 39.91 Progress: resolved 711, reused 0, downloaded 706, added 706
2026-05-22T10:20:10.2669525Z #13 40.54 Progress: resolved 1***6, reused 0, downloaded 777, added 406
2026-05-22T10:20:10.2854872Z #13 40.91 Progress: resolved 711, reused 0, downloaded 707, added 707
2026-05-22T10:20:11.2664890Z #13 41.54 Progress: resolved 1***6, reused 0, downloaded 790, added 432
2026-05-22T10:20:12.2664619Z #13 42.54 Progress: resolved 1***6, reused 0, downloaded 801, added 436
2026-05-22T10:20:13.2671857Z #13 43.54 Progress: resolved 1***6, reused 0, downloaded 819, added 444
2026-05-22T10:20:14.0802064Z #13 44.70 Progress: resolved 711, reused 0, downloaded 708, added 707
2026-05-22T10:20:14.2662625Z #13 44.54 Progress: resolved 1***6, reused 0, downloaded 886, added 571
2026-05-22T10:20:15.0806717Z #13 45.70 Progress: resolved 711, reused 0, downloaded 708, added 708
2026-05-22T10:20:15.2663717Z #13 45.54 Progress: resolved 1***6, reused 0, downloaded 1026, added 1011
2026-05-22T10:20:16.2671147Z #13 46.55 Progress: resolved 1***6, reused 0, downloaded 1105, added 1107
2026-05-22T10:20:17.2670787Z #13 47.55 Progress: resolved 1***6, reused 0, downloaded 1123, added 1111
2026-05-22T10:20:17.7556732Z #13 48.38 Progress: resolved 711, reused 0, downloaded 709, added 708
2026-05-22T10:20:18.2676595Z #13 48.55 Progress: resolved 1***6, reused 0, downloaded 1166, added 1142
2026-05-22T10:20:18.7556261Z #13 49.38 Progress: resolved 711, reused 0, downloaded 709, added 709
2026-05-22T10:20:19.2680881Z #13 49.55 Progress: resolved 1***6, reused 0, downloaded 1***2, added 1***4
2026-05-22T10:20:21.6300675Z #13 51.91 Progress: resolved 1***6, reused 0, downloaded 1***3, added 1***4
2026-05-22T10:20:22.6297608Z #13 52.91 Progress: resolved 1***6, reused 0, downloaded 1***3, added 1***5
2026-05-22T10:20:32.7986081Z #13 63.08 Progress: resolved 1***6, reused 0, downloaded 1***4, added 1***5
2026-05-22T10:20:32.9589470Z #13 63.09 Progress: resolved 1***6, reused 0, downloaded 1***4, added 1***6, done
2026-05-22T10:20:33.6542450Z #13 63.93 .../node_modules/@scarf/scarf postinstall$ node ./report.js
2026-05-22T10:20:33.7659245Z #13 64.01 .../node_modules/msgpackr-extract install$ node-gyp-build-optional-packages
2026-05-22T10:20:33.7660063Z #13 64.04 .../node_modules/@nestjs/core postinstall$ opencollective || exit 0
2026-05-22T10:20:33.9632047Z #13 64.09 .../bcrypt@6.0.0/node_modules/bcrypt install$ node-gyp-build
2026-05-22T10:20:34.0993964Z #13 64.38 .../bcrypt@6.0.0/node_modules/bcrypt install: Done
2026-05-22T10:20:34.3261983Z #13 64.45 .../node_modules/msgpackr-extract install: Done
2026-05-22T10:20:35.3790242Z #13 65.66 .../node_modules/@nestjs/core postinstall:                            Thanks for installing nest 
2026-05-22T10:20:35.5534031Z #13 65.66 .../node_modules/@nestjs/core postinstall:                  Please consider donating to our open collective
2026-05-22T10:20:35.5534832Z #13 65.66 .../node_modules/@nestjs/core postinstall:                         to help us maintain this package.
2026-05-22T10:20:35.5535089Z #13 65.66 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:20:35.5535290Z #13 65.66 .../node_modules/@nestjs/core postinstall:                             Number of contributors: 0
2026-05-22T10:20:35.5535571Z #13 65.66 .../node_modules/@nestjs/core postinstall:                              Number of backers: 1199
2026-05-22T10:20:35.5535878Z #13 65.67 .../node_modules/@nestjs/core postinstall:                              Annual budget: $135,630
2026-05-22T10:20:35.5536085Z #13 65.67 .../node_modules/@nestjs/core postinstall:                              Current balance: $3,366
2026-05-22T10:20:35.5536287Z #13 65.67 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:20:35.5536506Z #13 65.67 .../node_modules/@nestjs/core postinstall:              Become a partner: https://opencollective.com/nest/donate
2026-05-22T10:20:35.5536727Z #13 65.67 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:20:35.5536985Z #13 65.68 .../node_modules/@nestjs/core postinstall: Done
2026-05-22T10:20:37.0987329Z #13 67.72 Progress: resolved 711, reused 0, downloaded 710, added 709
2026-05-22T10:20:37.1847734Z #13 67.46 .../node_modules/@scarf/scarf postinstall: Done
2026-05-22T10:20:38.0986356Z #13 68.72 Progress: resolved 711, reused 0, downloaded 710, added 710
2026-05-22T10:20:39.0374307Z #13 69.32 . prepare$ husky
2026-05-22T10:20:39.1868474Z #13 69.41 . prepare: .git can't be found
2026-05-22T10:20:39.1869873Z #13 69.41 . prepare: Done
2026-05-22T10:20:39.1870309Z #13 69.46 Done in 1m 5.6s using pnpm v10.33.0
2026-05-22T10:20:42.7258061Z #13 DONE 73.0s
2026-05-22T10:20:44.9198949Z #13 75.54 Progress: resolved 711, reused 0, downloaded 711, added 710
2026-05-22T10:20:45.0727405Z #13 75.54 Progress: resolved 711, reused 0, downloaded 711, added 711, done
2026-05-22T10:20:46.1866797Z #13 76.81 Done in 1m 12.6s using pnpm v10.33.0
2026-05-22T10:20:50.0473617Z #13 DONE 80.7s
2026-05-22T10:20:57.8734840Z 
2026-05-22T10:20:57.8735552Z #14 [build  5/10] COPY --from=deps /app/node_modules ./node_modules
2026-05-22T10:21:03.1157655Z 
2026-05-22T10:21:03.1158369Z #14 [build  5/14] COPY --from=deps /w/node_modules ./node_modules
2026-05-22T10:21:48.3800147Z #14 DONE 50.5s
2026-05-22T10:21:48.5809097Z 
2026-05-22T10:21:48.5809964Z #15 [build  6/10] COPY --from=deps /app/backend/node_modules ./backend/node_modules
2026-05-22T10:21:51.6184735Z #15 DONE 3.2s
2026-05-22T10:21:51.8599819Z 
2026-05-22T10:21:51.8600605Z #16 [build  7/10] COPY backend/ ./backend/
2026-05-22T10:21:54.3196561Z #16 DONE 2.6s
2026-05-22T10:21:54.5186691Z 
2026-05-22T10:21:54.5187404Z #17 [build  8/10] RUN cd backend &&     NODE_OPTIONS="--max-old-space-size=4096"     pnpm run build
2026-05-22T10:21:56.8701605Z #17 2.502 ! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.33.0.tgz
2026-05-22T10:22:02.4667495Z #17 8.098 
2026-05-22T10:22:02.4668283Z #17 8.098 > backend@1.8.1 build /app/backend
2026-05-22T10:22:02.4668507Z #17 8.098 > nest build
2026-05-22T10:22:02.4668735Z #17 8.098 
2026-05-22T10:22:03.7954915Z #14 DONE 60.7s
2026-05-22T10:22:03.9900869Z 
2026-05-22T10:22:03.9901576Z #15 [build  6/14] WORKDIR /w/frontend
2026-05-22T10:22:05.5568666Z #15 DONE 1.7s
2026-05-22T10:22:05.7719151Z 
2026-05-22T10:22:05.7720189Z #16 [build  7/14] COPY --from=deps /w/frontend/node_modules ./node_modules
2026-05-22T10:22:07.5913742Z #16 DONE 2.0s
2026-05-22T10:22:07.8207728Z 
2026-05-22T10:22:07.8208523Z #17 [build  8/14] COPY frontend/ ./
2026-05-22T10:22:10.3511728Z #17 DONE 2.7s
2026-05-22T10:22:10.5803092Z 
2026-05-22T10:22:10.5804009Z #18 [build  9/14] RUN ls -la /w/frontend/public/ || (echo "WARNING: public directory not found, creating empty one" && mkdir -p /w/frontend/public)
2026-05-22T10:22:12.1832337Z #18 1.754 total 36
2026-05-22T10:22:12.3336139Z #18 1.754 drwxrwxrwx    3 root     root          4096 Apr 19 06:21 .
2026-05-22T10:22:12.3336895Z #18 1.754 drwxr-xr-x    1 root     root          4096 May 16 04:06 ..
2026-05-22T10:22:12.3337114Z #18 1.754 -rw-rw-rw-    1 root     root           130 Apr  1 15:50 favicon.ico
2026-05-22T10:22:12.3337323Z #18 1.754 drwxrwxrwx    4 root     root          4096 Apr 19 06:21 locales
2026-05-22T10:22:12.3337606Z #18 1.754 -rw-rw-rw-    1 root     root           140 Apr  1 15:50 robots.txt
2026-05-22T10:22:13.5249993Z #18 DONE 3.1s
2026-05-22T10:22:13.7639793Z 
2026-05-22T10:22:13.7640568Z #19 [build 10/14] RUN set -e;     MONACO_VS=$(find /w/frontend/node_modules /w/node_modules       -path "*/monaco-editor/min/vs" -type d 2>/dev/null | head -1);     if [ -z "$MONACO_VS" ]; then       echo "ERROR: monaco-editor/min/vs not found in node_modules" && exit 1;     fi;     echo "Found Monaco at: $MONACO_VS";     mkdir -p /w/frontend/public;     cp -rL "$MONACO_VS" /w/frontend/public/monaco-vs;     echo "Monaco assets copied successfully"
2026-05-22T10:22:17.2152721Z #19 3.602 Found Monaco at: /w/node_modules/.pnpm/monaco-editor@0.55.1/node_modules/monaco-editor/min/vs
2026-05-22T10:22:17.4186717Z #19 3.655 Monaco assets copied successfully
2026-05-22T10:22:19.7877839Z #19 DONE 6.2s
2026-05-22T10:22:20.0087651Z 
2026-05-22T10:22:20.0088606Z #20 [build 11/14] RUN mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next
2026-05-22T10:22:21.6801154Z #20 1.8*** ! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.33.0.tgz
2026-05-22T10:22:25.7086552Z #20 5.850 
2026-05-22T10:22:25.7087468Z #20 5.850 > lcbp3-frontend@1.8.1 build /w/frontend
2026-05-22T10:22:25.7088115Z #20 5.850 > next build
2026-05-22T10:22:25.7088398Z #20 5.850 
2026-05-22T10:22:26.6182694Z #17 DONE 32.2s
2026-05-22T10:22:26.7787255Z #20 6.921 ▲ Next.js 16.2.6 (Turbopack)
2026-05-22T10:22:26.8697195Z 
2026-05-22T10:22:26.8697906Z #18 [build  9/10] RUN PNPM_IGNORE_SCRIPTS=none     pnpm --filter backend deploy --prod --shamefully-hoist --legacy --no-optional /app/backend-prod
2026-05-22T10:22:26.8928351Z #20 6.9*** 
2026-05-22T10:22:26.8929224Z #20 7.034   Creating an optimized production build ...
2026-05-22T10:22:31.8657302Z #18 4.997  WARN  Shared workspace lockfile detected but configuration forces legacy deploy implementation.
2026-05-22T10:22:32.1691347Z #18 5.300 Packages are copied from the content-addressable store to the virtual store.
2026-05-22T10:22:32.1692146Z #18 5.300   Content-addressable store is at: /root/.local/share/pnpm/store/v10
2026-05-22T10:22:32.1692385Z #18 5.300   Virtual store is at:             backend-prod/node_modules/.pnpm
2026-05-22T10:22:33.5200696Z #18 6.650 Progress: resolved 0, reused 0, downloaded 1, added 0
2026-05-22T10:22:34.5252864Z #18 7.656 Progress: resolved 10, reused 0, downloaded 10, added 0
2026-05-22T10:22:35.5263721Z #18 8.657 Progress: resolved 16, reused 0, downloaded 16, added 0
2026-05-22T10:22:36.5265724Z #18 9.657 Progress: resolved 17, reused 0, downloaded 17, added 0
2026-05-22T10:22:37.5273329Z #18 10.66 Progress: resolved 21, reused 0, downloaded 21, added 0
2026-05-22T10:22:38.5288511Z #18 11.66 Progress: resolved 24, reused 0, downloaded 24, added 0
2026-05-22T10:22:39.5292423Z #18 12.66 Progress: resolved 31, reused 0, downloaded 31, added 0
2026-05-22T10:22:40.5332742Z #18 13.66 Progress: resolved 57, reused 0, downloaded 57, added 0
2026-05-22T10:22:41.5359075Z #18 14.67 Progress: resolved 70, reused 0, downloaded 70, added 0
2026-05-22T10:22:42.5337455Z #18 15.66 Progress: resolved 87, reused 0, downloaded 87, added 0
2026-05-22T10:22:43.5349070Z #18 16.67 Progress: resolved 88, reused 0, downloaded 88, added 0
2026-05-22T10:22:44.5496488Z #18 17.68 Progress: resolved 103, reused 0, downloaded 103, added 0
2026-05-22T10:22:45.5498150Z #18 18.68 Progress: resolved 118, reused 0, downloaded 118, added 0
2026-05-22T10:22:46.5501022Z #18 19.68 Progress: resolved 139, reused 0, downloaded 139, added 0
2026-05-22T10:22:47.5536430Z #18 20.68 Progress: resolved 153, reused 0, downloaded 153, added 0
2026-05-22T10:22:48.5550042Z #18 21.69 Progress: resolved 219, reused 0, downloaded 219, added 0
2026-05-22T10:22:49.5564982Z #18 ***.69 Progress: resolved 230, reused 0, downloaded 230, added 0
2026-05-22T10:22:50.5572366Z #18 23.69 Progress: resolved 239, reused 0, downloaded 239, added 0
2026-05-22T10:22:51.5767798Z #18 24.71 Progress: resolved 261, reused 0, downloaded 261, added 0
2026-05-22T10:22:52.5871417Z #18 25.72 Progress: resolved 276, reused 0, downloaded 276, added 0
2026-05-22T10:22:53.5882651Z #18 26.72 Progress: resolved 299, reused 0, downloaded 299, added 0
2026-05-22T10:22:54.5933892Z #18 27.72 Progress: resolved 339, reused 0, downloaded 339, added 0
2026-05-22T10:22:55.5958588Z #18 28.73 Progress: resolved 358, reused 0, downloaded 358, added 0
2026-05-22T10:22:56.5970237Z #18 29.73 Progress: resolved 365, reused 0, downloaded 365, added 0
2026-05-22T10:22:57.5968739Z #18 30.73 Progress: resolved 392, reused 0, downloaded 392, added 0
2026-05-22T10:22:58.5971971Z #18 31.73 Progress: resolved 460, reused 0, downloaded 460, added 0
2026-05-22T10:22:59.5974400Z #18 32.73 Progress: resolved 550, reused 0, downloaded 549, added 0
2026-05-22T10:23:00.5445209Z #20 40.69 Turbopack build encountered 1 warnings:
2026-05-22T10:23:00.5445916Z #20 40.69 [next]/internal/font/google/inter_5972bc34.module.css
2026-05-22T10:23:00.5446136Z #20 40.69 Error while requesting resource
2026-05-22T10:23:00.5446783Z #20 40.69 There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap
2026-05-22T10:23:00.5447166Z #20 40.69 
2026-05-22T10:23:00.5447353Z #20 40.69 Import trace:
2026-05-22T10:23:00.5447587Z #20 40.69   Server Component:
2026-05-22T10:23:00.5447882Z #20 40.69     [next]/internal/font/google/inter_5972bc34.module.css
2026-05-22T10:23:00.5448081Z #20 40.69     [next]/internal/font/google/inter_5972bc34.js
2026-05-22T10:23:00.5448262Z #20 40.69     ./frontend/app/layout.tsx
2026-05-22T10:23:00.5448570Z #20 40.69 
2026-05-22T10:23:00.5448754Z #20 40.69 
2026-05-22T10:23:00.5983815Z #18 33.73 Progress: resolved 602, reused 0, downloaded 602, added 0
2026-05-22T10:23:00.8575643Z #20 41.00 
2026-05-22T10:23:01.0182974Z #20 41.00 > Build error occurred
2026-05-22T10:23:01.0183864Z #20 41.01 Error: Turbopack build failed with 1 errors:
2026-05-22T10:23:01.0184097Z #20 41.01 [next]/internal/font/google/inter_5972bc34.module.css
2026-05-22T10:23:01.0184608Z #20 41.01 next/font: error:
2026-05-22T10:23:01.0184867Z #20 41.01 Failed to fetch `Inter` from Google Fonts.
2026-05-22T10:23:01.0185111Z #20 41.01 
2026-05-22T10:23:01.0185417Z #20 41.01 Import trace:
2026-05-22T10:23:01.0185616Z #20 41.01   Server Component:
2026-05-22T10:23:01.0185863Z #20 41.01     [next]/internal/font/google/inter_5972bc34.module.css
2026-05-22T10:23:01.0186107Z #20 41.01     [next]/internal/font/google/inter_5972bc34.js
2026-05-22T10:23:01.0186384Z #20 41.01     ./frontend/app/layout.tsx
2026-05-22T10:23:01.0186635Z #20 41.01 
2026-05-22T10:23:01.0186906Z #20 41.01 
2026-05-22T10:23:01.0187201Z #20 41.01     at ignore-listed frames
2026-05-22T10:23:01.0568091Z #20 41.20  ELIFECYCLE  Command failed with exit code 1.
2026-05-22T10:23:01.5980624Z #18 34.73 Progress: resolved 630, reused 0, downloaded 623, added 0
2026-05-22T10:23:02.5977426Z #18 35.73 Progress: resolved 653, reused 0, downloaded 647, added 0
2026-05-22T10:23:03.5982137Z #18 36.73 Progress: resolved 700, reused 0, downloaded 695, added 0
2026-05-22T10:23:04.5991787Z #18 37.73 Progress: resolved 749, reused 0, downloaded 744, added 0
2026-05-22T10:23:05.5993267Z #18 38.73 Progress: resolved 794, reused 0, downloaded 789, added 0
2026-05-22T10:23:06.5995710Z #18 39.73 Progress: resolved 839, reused 0, downloaded 834, added 0
2026-05-22T10:23:07.6002428Z #18 40.73 Progress: resolved 869, reused 0, downloaded 864, added 0
2026-05-22T10:23:08.6009661Z #18 41.73 Progress: resolved 972, reused 0, downloaded 964, added 0
2026-05-22T10:23:09.0372542Z #20 ERROR: process "/bin/sh -c mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next" did not complete successfully: exit code: 1
2026-05-22T10:23:09.6015507Z #18 42.73 Progress: resolved 1084, reused 0, downloaded 1079, added 0
2026-05-22T10:23:10.6070375Z #18 43.74 Progress: resolved 1215, reused 0, downloaded 1205, added 0
2026-05-22T10:23:10.6771401Z ------
2026-05-22T10:23:10.6772149Z  > [build 11/14] RUN mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next:
2026-05-22T10:23:10.6772536Z 41.01 
2026-05-22T10:23:10.6772804Z 41.01 Import trace:
2026-05-22T10:23:10.6773101Z 41.01   Server Component:
2026-05-22T10:23:10.6773410Z 41.01     [next]/internal/font/google/inter_5972bc34.module.css
2026-05-22T10:23:10.6773605Z 41.01     [next]/internal/font/google/inter_5972bc34.js
2026-05-22T10:23:10.6774021Z 41.01     ./frontend/app/layout.tsx
2026-05-22T10:23:10.6774261Z 41.01 
2026-05-22T10:23:10.6774470Z 41.01 
2026-05-22T10:23:10.6774708Z 41.01     at ignore-listed frames
2026-05-22T10:23:10.6775150Z 41.20  ELIFECYCLE  Command failed with exit code 1.
2026-05-22T10:23:10.6775376Z ------
2026-05-22T10:23:10.6780676Z Dockerfile:83
2026-05-22T10:23:10.6781089Z --------------------
2026-05-22T10:23:10.6781412Z   82 |     # to minimise overlay nesting depth, then move back after build completes.
2026-05-22T10:23:10.6781690Z   83 | >>> RUN mkdir /n && ln -s /n .next && \
2026-05-22T10:23:10.6781933Z   84 | >>>     pnpm run build && \
2026-05-22T10:23:10.6782198Z   85 | >>>     rm .next && mv /n .next
2026-05-22T10:23:10.6782423Z   86 |     
2026-05-22T10:23:10.6782592Z --------------------
2026-05-22T10:23:10.6782928Z ERROR: failed to solve: process "/bin/sh -c mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next" did not complete successfully: exit code: 1
2026-05-22T10:23:11.6074237Z #18 44.74 Progress: resolved 1245, reused 0, downloaded 1***0, added 0
2026-05-22T10:23:12.6076786Z #18 45.74 Progress: resolved 1250, reused 0, downloaded 1***5, added 0
2026-05-22T10:23:13.6081726Z #18 46.74 Progress: resolved 1253, reused 0, downloaded 1***6, added 0
2026-05-22T10:23:14.3493706Z #18 47.48  WARN  3 deprecated subdependencies found: glob@7.2.3, inflight@1.0.6, whatwg-encoding@3.1.1
2026-05-22T10:23:14.5890259Z #18 47.57 .                                        | +459 ++++++++++++++++++++++++++++++++
2026-05-22T10:23:14.6082338Z #18 47.74 Progress: resolved 1253, reused 0, downloaded 1***8, added 0
2026-05-22T10:23:15.6088985Z #18 48.74 Progress: resolved 1253, reused 0, downloaded 1***9, added 307
2026-05-22T10:23:16.0010091Z #18 49.13 Progress: resolved 1253, reused 0, downloaded 1***9, added 459, done
2026-05-22T10:23:16.1391932Z #18 49.27 .../node_modules/@scarf/scarf postinstall$ node ./report.js
2026-05-22T10:23:16.3305837Z #18 49.31 .../node_modules/@nestjs/core postinstall$ opencollective || exit 0
2026-05-22T10:23:16.3306573Z #18 49.31 .../bcrypt@6.0.0/node_modules/bcrypt install$ node-gyp-build
2026-05-22T10:23:16.4106310Z #18 49.54 .../bcrypt@6.0.0/node_modules/bcrypt install: Done
2026-05-22T10:23:16.5657857Z #18 49.70 .../node_modules/@nestjs/core postinstall:                            Thanks for installing nest 
2026-05-22T10:23:16.8147905Z #18 49.70 .../node_modules/@nestjs/core postinstall:                  Please consider donating to our open collective
2026-05-22T10:23:16.8148924Z #18 49.70 .../node_modules/@nestjs/core postinstall:                         to help us maintain this package.
2026-05-22T10:23:16.8149162Z #18 49.71 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:23:16.8149380Z #18 49.71 .../node_modules/@nestjs/core postinstall:                             Number of contributors: 0
2026-05-22T10:23:16.8149699Z #18 49.71 .../node_modules/@nestjs/core postinstall:                              Number of backers: 1199
2026-05-22T10:23:16.8149900Z #18 49.72 .../node_modules/@nestjs/core postinstall:                              Annual budget: $135,630
2026-05-22T10:23:16.8150584Z #18 49.73 .../node_modules/@nestjs/core postinstall:                              Current balance: $3,366
2026-05-22T10:23:16.8150819Z #18 49.73 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:23:16.8151077Z #18 49.73 .../node_modules/@nestjs/core postinstall:              Become a partner: https://opencollective.com/nest/donate
2026-05-22T10:23:16.8151387Z #18 49.73 .../node_modules/@nestjs/core postinstall:                                          
2026-05-22T10:23:16.8151691Z #18 49.79 .../node_modules/@nestjs/core postinstall: Done
2026-05-22T10:23:19.2867046Z #18 52.41 .../node_modules/@scarf/scarf postinstall: Done
2026-05-22T10:23:19.5083997Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin.js'
2026-05-22T10:23:19.5084912Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-cwd. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-cwd.js'
2026-05-22T10:23:19.5085267Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-esm. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-esm.js'
2026-05-22T10:23:19.5085879Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-script. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-script.js'
2026-05-22T10:23:19.5086320Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-transpile-only. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-transpile.js'
2026-05-22T10:23:19.5086789Z #18 52.49  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-script. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-script-deprecated.js'
2026-05-22T10:23:19.7667354Z #18 52.90  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/acorn. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/acorn@8.16.0/node_modules/acorn/bin/acorn'
2026-05-22T10:23:19.9179844Z #18 52.90  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/browserslist. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/browserslist@4.28.1/node_modules/browserslist/cli.js'
2026-05-22T10:23:19.9180666Z #18 52.90  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/webpack. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/webpack@5.105.4/node_modules/webpack/bin/webpack.js'
2026-05-22T10:23:19.9180959Z #18 52.90  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/jiti. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/jiti@2.6.1/node_modules/jiti/lib/jiti-cli.mjs'
2026-05-22T10:23:20.2224622Z #18 53.35 . prepare$ husky
2026-05-22T10:23:20.4592649Z #18 53.44 . prepare: .git can't be found
2026-05-22T10:23:20.4593647Z #18 53.44 . prepare: Done
2026-05-22T10:23:26.6357222Z #18 DONE 59.8s
2026-05-22T10:23:26.8249481Z 
2026-05-22T10:23:26.8250648Z #19 [build 10/10] RUN find /app/backend-prod/node_modules -name "*.md" -delete     && find /app/backend-prod/node_modules -name "*.txt" -delete     && find /app/backend-prod/node_modules -name "LICENSE*" -delete     && find /app/backend-prod/node_modules -name "README*" -delete     && find /app/backend-prod/node_modules -name "CHANGELOG*" -delete
2026-05-22T10:23:32.1643335Z #19 DONE 5.5s
2026-05-22T10:23:33.4248798Z 
2026-05-22T10:23:33.4249492Z #20 [production 2/8] RUN apk add --no-cache curl
2026-05-22T10:23:33.4249774Z #20 CACHED
2026-05-22T10:23:33.4250129Z 
2026-05-22T10:23:33.4250412Z #21 [production 3/8] WORKDIR /app
2026-05-22T10:23:33.4250607Z #21 CACHED
2026-05-22T10:23:33.4250788Z 
2026-05-22T10:23:33.4251041Z #*** [production 4/8] RUN addgroup -g 1001 -S nestjs &&     adduser -S nestjs -u 1001
2026-05-22T10:23:33.5757779Z #*** CACHED
2026-05-22T10:23:33.5758523Z 
2026-05-22T10:23:33.5758720Z #23 [production 5/8] COPY --from=build --chown=nestjs:nestjs /app/backend/dist ./dist
2026-05-22T10:23:35.5036038Z #23 DONE 2.1s
2026-05-22T10:23:41.4159508Z 
2026-05-22T10:23:41.4160274Z #24 [production 6/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/package.json ./
2026-05-22T10:23:43.3318723Z #24 DONE 1.9s
2026-05-22T10:23:43.5386315Z 
2026-05-22T10:23:43.5387475Z #25 [production 7/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/node_modules ./node_modules
2026-05-22T10:23:56.3393298Z #25 DONE 13.0s
2026-05-22T10:23:56.5531944Z 
2026-05-22T10:23:56.5532716Z #26 [production 8/8] RUN mkdir -p /app/uploads/temp /app/uploads/permanent &&     chown -R nestjs:nestjs /app/uploads
2026-05-22T10:23:59.8696545Z #26 DONE 3.5s
2026-05-22T10:24:00.0399935Z 
2026-05-22T10:24:00.0400666Z #27 exporting to image
2026-05-22T10:24:00.0401182Z #27 exporting layers
2026-05-22T10:24:06.4530849Z #27 exporting layers 6.4s done
2026-05-22T10:24:06.6897164Z #27 writing image sha256:5bea8635f5e3d17befa2d42c144ebad76c9586766564a355528cb1cd6c215978 0.0s done
2026-05-22T10:24:06.6898016Z #27 naming to docker.io/library/lcbp3-backend:latest 0.1s done
2026-05-22T10:24:06.8783900Z #27 DONE 6.8s
2026-05-22T10:24:08.6318421Z ✗ Frontend build failed!
2026-05-22T10:24:08.6358306Z   ❌  Failure - Main 🚀 Deploy to QNAP
2026-05-22T10:24:08.6509404Z exitcode '1': failure
2026-05-22T10:24:08.6850444Z evaluating expression 'always()'
2026-05-22T10:24:08.6851332Z expression 'always()' evaluated to 'true'
2026-05-22T10:24:08.6851584Z ⭐ Run Post  Checkout
2026-05-22T10:24:08.6851972Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-22T10:24:08.6852271Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-22T10:24:08.6852480Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-22T10:24:08.6852702Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T10:24:08.6852893Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-22T10:24:08.6853379Z Extracting content to '/var/run/act'
2026-05-22T10:24:08.6896063Z run post step for ' Checkout'
2026-05-22T10:24:08.6898141Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-22T10:24:08.6898544Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-22T10:24:08.6898788Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-22T10:24:08.6899532Z Working directory '/workspace/np-dms/lcbp3'
2026-05-22T10:24:09.0123893Z [command]/usr/bin/git version
2026-05-22T10:24:09.0213596Z git version 2.30.2
2026-05-22T10:24:09.0281515Z ***
2026-05-22T10:24:09.0318978Z Temporarily overriding HOME='/tmp/6a9d0132-4f19-4b7b-9386-c0881115a0c0' before making global git config changes
2026-05-22T10:24:09.0321291Z Adding repository directory to the temporary git global config as a safe directory
2026-05-22T10:24:09.0337385Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-22T10:24:09.0430192Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-22T10:24:09.0515049Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-22T10:24:09.1132415Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-22T10:24:09.1199770Z http.https://git.np-dms.work/.extraheader
2026-05-22T10:24:09.1225636Z [command]/usr/bin/git config --local --unset-all http.https://git.np-dms.work/.extraheader
2026-05-22T10:24:09.1319879Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-22T10:24:09.1940569Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-22T10:24:09.2040311Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-22T10:24:09.2723897Z   ✅  Success - Post  Checkout
2026-05-22T10:24:09.2854292Z Cleaning up container for job deploy
2026-05-22T10:24:11.0047747Z Removed container: 01e4a727333d4c4537456a6cf1c4cb5756fea90f93313931fbf1d1185da90a0a
2026-05-22T10:24:11.0062802Z   🐳  docker volume rm GITEA-ACTIONS-TASK-500_WORKFLOW-CI-CD-Pipeline_JOB-deploy
2026-05-22T10:24:11.2756102Z   🐳  docker volume rm GITEA-ACTIONS-TASK-500_WORKFLOW-CI-CD-Pipeline_JOB-deploy-env
2026-05-22T10:24:11.5323408Z 🏁  Job failed
2026-05-22T10:24:11.5426433Z Job 'deploy' failed
