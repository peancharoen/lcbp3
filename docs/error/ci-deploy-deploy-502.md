2026-05-22T14:31:03.3328125Z asustor-runner(version:v0.4.0) received task 502 of job deploy, be triggered by event: push
2026-05-22T14:31:03.3332310Z workflow prepared
2026-05-22T14:31:03.3333111Z evaluating expression 'success()'
2026-05-22T14:31:03.3334186Z expression 'success()' evaluated to 'true'
2026-05-22T14:31:03.3334361Z 'runs-on' key not defined in CI / CD Pipeline/build
2026-05-22T14:31:03.3334525Z No steps found
2026-05-22T14:31:03.3335344Z evaluating expression 'github.ref == 'refs/heads/main''
2026-05-22T14:31:03.3336000Z expression 'github.ref == 'refs/heads/main'' evaluated to 'true'
2026-05-22T14:31:03.3336278Z 🚀  Start image=node:18-bullseye
2026-05-22T14:31:03.3441484Z   🐳  docker pull image=node:18-bullseye platform= username= forcePull=false
2026-05-22T14:31:03.3441811Z   🐳  docker pull node:18-bullseye
2026-05-22T14:31:03.3463738Z Image exists? true
2026-05-22T14:31:03.3531904Z   🐳  docker create image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-22T14:31:17.8536193Z Created container name=GITEA-ACTIONS-TASK-502_WORKFLOW-CI-CD-Pipeline_JOB-deploy id=0877d84d997c7728dbdff6e4e6e5be3bf8c2302dbcf8faadbad207e08355babd from image node:18-bullseye (platform: )
2026-05-22T14:31:17.8536797Z ENV ==> [RUNNER_TOOL_CACHE=/opt/hostedtoolcache RUNNER_OS=Linux RUNNER_ARCH=X64 RUNNER_TEMP=/tmp LANG=C.UTF-8]
2026-05-22T14:31:17.8537003Z   🐳  docker run image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-22T14:31:17.8537216Z Starting container: 0877d84d997c7728dbdff6e4e6e5be3bf8c2302dbcf8faadbad207e08355babd
2026-05-22T14:31:20.4213347Z Started container: 0877d84d997c7728dbdff6e4e6e5be3bf8c2302dbcf8faadbad207e08355babd
2026-05-22T14:31:20.5757245Z Writing entry to tarball workflow/event.json len:5263
2026-05-22T14:31:20.5758058Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T14:31:20.5758324Z Extracting content to '/var/run/act/'
2026-05-22T14:31:20.5997510Z   ☁  git clone 'https://github.com/actions/checkout' # ref=v4
2026-05-22T14:31:20.5998029Z   cloning https://github.com/actions/checkout to /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T14:31:21.9113060Z Non-terminating error while running 'git clone': some refs were not updated
2026-05-22T14:31:21.9417034Z evaluating expression ''
2026-05-22T14:31:21.9417977Z expression '' evaluated to 'true'
2026-05-22T14:31:21.9418203Z ⭐ Run Main  Checkout
2026-05-22T14:31:21.9418538Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-22T14:31:21.9418838Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-22T14:31:21.9419047Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-22T14:31:21.9419254Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T14:31:21.9419436Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-22T14:31:21.9419710Z Extracting content to '/var/run/act'
2026-05-22T14:31:21.9552670Z expression '${{ github.token }}' rewritten to 'format('{0}', github.token)'
2026-05-22T14:31:21.9553265Z evaluating expression 'format('{0}', github.token)'
2026-05-22T14:31:21.9553830Z expression 'format('{0}', github.token)' evaluated to '%!t(string=***)'
2026-05-22T14:31:21.9554865Z expression '${{ github.repository }}' rewritten to 'format('{0}', github.repository)'
2026-05-22T14:31:21.9555061Z evaluating expression 'format('{0}', github.repository)'
2026-05-22T14:31:21.9555404Z expression 'format('{0}', github.repository)' evaluated to '%!t(string=np-dms/lcbp3)'
2026-05-22T14:31:21.9555983Z type=remote-action actionDir=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab actionPath= workdir=/workspace/np-dms/lcbp3 actionCacheDir=/root/.cache/act actionName=c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab containerActionDir=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T14:31:21.9556301Z /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-22T14:31:21.9556663Z   🐳  docker cp src=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ dst=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T14:31:21.9558802Z Writing tarball /tmp/act30230***604 from /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T14:31:21.9559096Z Stripping prefix:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ src:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-22T14:31:22.1555591Z Extracting content from '/tmp/act30230***604' to '/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/'
2026-05-22T14:31:22.4656938Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-22T14:31:22.4657681Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-22T14:31:22.4657943Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-22T14:31:22.4658659Z Working directory '/workspace/np-dms/lcbp3'
2026-05-22T14:31:22.7690118Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-22T14:31:22.7690605Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-22T14:31:22.7699476Z Syncing repository: np-dms/lcbp3
2026-05-22T14:31:22.7707998Z ::group::Getting Git version info
2026-05-22T14:31:22.7710546Z Working directory is '/workspace/np-dms/lcbp3'
2026-05-22T14:31:22.7773777Z [command]/usr/bin/git version
2026-05-22T14:31:22.7844944Z git version 2.30.2
2026-05-22T14:31:22.7899504Z ::endgroup::
2026-05-22T14:31:22.7933736Z Temporarily overriding HOME='/tmp/fecfbe56-71bb-4bea-b817-3b7de0c88d43' before making global git config changes
2026-05-22T14:31:22.7934710Z Adding repository directory to the temporary git global config as a safe directory
2026-05-22T14:31:22.7949464Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-22T14:31:22.8027495Z Deleting the contents of '/workspace/np-dms/lcbp3'
2026-05-22T14:31:22.8034493Z ::group::Initializing the repository
2026-05-22T14:31:22.8045027Z [command]/usr/bin/git init /workspace/np-dms/lcbp3
2026-05-22T14:31:22.8110963Z hint: Using 'master' as the name for the initial branch. This default branch name
2026-05-22T14:31:22.8111685Z hint: is subject to change. To configure the initial branch name to use in all
2026-05-22T14:31:22.8112010Z hint: of your new repositories, which will suppress this warning, call:
2026-05-22T14:31:22.8112228Z hint: 
2026-05-22T14:31:22.8112477Z hint: 	git config --global init.defaultBranch <name>
2026-05-22T14:31:22.8112690Z hint: 
2026-05-22T14:31:22.8112856Z hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
2026-05-22T14:31:22.8113048Z hint: 'development'. The just-created branch can be renamed via this command:
2026-05-22T14:31:22.8113412Z hint: 
2026-05-22T14:31:22.8113603Z hint: 	git branch -m <name>
2026-05-22T14:31:22.8121887Z Initialized empty Git repository in /workspace/np-dms/lcbp3/.git/
2026-05-22T14:31:22.8146980Z [command]/usr/bin/git remote add origin https://git.np-dms.work/np-dms/lcbp3
2026-05-22T14:31:22.8215467Z ::endgroup::
2026-05-22T14:31:22.8215891Z ::group::Disabling automatic garbage collection
2026-05-22T14:31:22.8222804Z [command]/usr/bin/git config --local gc.auto 0
2026-05-22T14:31:22.8286457Z ::endgroup::
2026-05-22T14:31:22.8286979Z ::group::Setting up auth
2026-05-22T14:31:22.8300161Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-22T14:31:22.8362786Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-22T14:31:22.8860643Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-22T14:31:22.8928348Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-22T14:31:22.9438895Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-22T14:31:22.9505593Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-22T14:31:23.0020764Z [command]/usr/bin/git config --local http.https://git.np-dms.work/.extraheader AUTHORIZATION: basic ***
2026-05-22T14:31:23.0104324Z ::endgroup::
2026-05-22T14:31:23.0104932Z ::group::Fetching the repository
2026-05-22T14:31:23.0122166Z [command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +433b149c859489176ab377c64b99e095fe04ae60:refs/remotes/origin/main
2026-05-22T14:31:25.8774100Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-22T14:31:25.8774843Z  * [new ref]         433b149c859489176ab377c64b99e095fe04ae60 -> origin/main
2026-05-22T14:31:25.8820837Z ::endgroup::
2026-05-22T14:31:25.8821306Z ::group::Determining the checkout info
2026-05-22T14:31:25.8823955Z ::endgroup::
2026-05-22T14:31:25.8831940Z [command]/usr/bin/git sparse-checkout disable
2026-05-22T14:31:25.8908783Z [command]/usr/bin/git config --local --unset-all extensions.worktreeConfig
2026-05-22T14:31:25.8966693Z ::group::Checking out the ref
2026-05-22T14:31:25.8976151Z [command]/usr/bin/git checkout --progress --force -B main refs/remotes/origin/main
2026-05-22T14:31:26.2672970Z Switched to a new branch 'main'
2026-05-22T14:31:26.2674728Z Branch 'main' set up to track remote branch 'main' from 'origin'.
2026-05-22T14:31:26.2700215Z ::endgroup::
2026-05-22T14:31:26.2772629Z [command]/usr/bin/git log -1 --format=%H
2026-05-22T14:31:26.2824422Z 433b149c859489176ab377c64b99e095fe04ae60
2026-05-22T14:31:26.2854100Z ::remove-matcher owner=checkout-git::
2026-05-22T14:31:27.5794703Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-22T14:31:27.5795801Z  * branch              main       -> FETCH_HEAD
2026-05-22T14:31:27.5812954Z    942cda48..433b149c  main       -> origin/main
2026-05-22T14:31:27.6517837Z HEAD is now at 433b149c 6905***:2125 ADR-028-***8 #02
2026-05-22T14:31:27.6559695Z =========================================
2026-05-22T14:31:27.6560538Z LCBP3-DMS Deployment v2.0
2026-05-22T14:31:27.6560779Z =========================================
2026-05-22T14:31:27.7611702Z [1/3] Building Docker images (parallel)...
2026-05-22T14:31:28.7067368Z #0 building with "default" instance using docker driver
2026-05-22T14:31:28.7068137Z 
2026-05-22T14:31:28.7068317Z #1 [internal] load build definition from Dockerfile
2026-05-22T14:31:28.7068506Z #1 transferring dockerfile:
2026-05-22T14:31:28.7864969Z #0 building with "default" instance using docker driver
2026-05-22T14:31:28.7865707Z 
2026-05-22T14:31:28.7865900Z #1 [internal] load build definition from Dockerfile
2026-05-22T14:31:28.7866088Z #1 transferring dockerfile:
2026-05-22T14:31:28.8617501Z #1 transferring dockerfile: 3.28kB done
2026-05-22T14:31:28.9401575Z #1 transferring dockerfile: 5.15kB done
2026-05-22T14:31:29.0422117Z #1 DONE 0.4s
2026-05-22T14:31:29.1672122Z 
2026-05-22T14:31:29.1675128Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-22T14:31:29.3587759Z #1 DONE 0.7s
2026-05-22T14:31:29.5799384Z 
2026-05-22T14:31:29.5800355Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-22T14:31:31.2210493Z #2 DONE 1.8s
2026-05-22T14:31:31.2211241Z #2 DONE 2.1s
2026-05-22T14:31:31.3271245Z 
2026-05-22T14:31:31.3272003Z #3 [internal] load .dockerignore
2026-05-22T14:31:31.3272305Z #3 transferring context:
2026-05-22T14:31:31.4185217Z 
2026-05-22T14:31:31.4185993Z #3 [internal] load .dockerignore
2026-05-22T14:31:31.4186252Z #3 transferring context: 1.12kB done
2026-05-22T14:31:31.4802263Z #3 transferring context: 1.12kB done
2026-05-22T14:31:31.5701837Z #3 DONE 0.3s
2026-05-22T14:31:31.7088000Z #3 DONE 0.5s
2026-05-22T14:31:31.8191401Z 
2026-05-22T14:31:31.8192180Z #4 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T14:31:31.8192504Z #4 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T14:31:31.9651853Z 
2026-05-22T14:31:31.9652546Z #4 [internal] load build context
2026-05-22T14:31:31.9652783Z #4 DONE 0.0s
2026-05-22T14:31:31.9652984Z 
2026-05-22T14:31:31.9653372Z #5 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T14:31:31.9653634Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T14:31:31.9717655Z #4 ...
2026-05-22T14:31:31.9718325Z 
2026-05-22T14:31:31.9718517Z #5 [internal] load build context
2026-05-22T14:31:31.9718783Z #5 DONE 0.0s
2026-05-22T14:31:32.1219945Z 
2026-05-22T14:31:32.1220650Z #4 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-22T14:31:32.2345116Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.4s done
2026-05-22T14:31:32.2345883Z #4 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.4s done
2026-05-22T14:31:32.3834361Z #5 DONE 0.4s
2026-05-22T14:31:32.3835042Z 
2026-05-22T14:31:32.3835231Z #4 [internal] load build context
2026-05-22T14:31:32.3902439Z #4 DONE 0.4s
2026-05-22T14:31:32.3903283Z 
2026-05-22T14:31:32.3903599Z #5 [internal] load build context
2026-05-22T14:31:32.3903858Z #5 transferring context: 134.46kB 0.1s done
2026-05-22T14:31:32.6165813Z #4 transferring context: 157.60kB 0.1s done
2026-05-22T14:31:32.7202160Z #5 DONE 0.5s
2026-05-22T14:31:33.0299690Z #4 DONE 0.8s
2026-05-22T14:31:33.0929390Z 
2026-05-22T14:31:33.0930184Z #6 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-22T14:31:33.0930776Z #6 CACHED
2026-05-22T14:31:33.0931045Z 
2026-05-22T14:31:33.0931213Z #7 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T14:31:33.0931482Z #7 CACHED
2026-05-22T14:31:33.0931832Z 
2026-05-22T14:31:33.0932066Z #8 [deps 5/6] COPY frontend/package.json ./frontend/
2026-05-22T14:31:33.0932305Z #8 CACHED
2026-05-22T14:31:33.0932521Z 
2026-05-22T14:31:33.0932693Z #9 [build  5/14] COPY --from=deps /w/node_modules ./node_modules
2026-05-22T14:31:33.0932947Z #9 CACHED
2026-05-22T14:31:33.0933245Z 
2026-05-22T14:31:33.0933486Z #10 [build  6/14] WORKDIR /w/frontend
2026-05-22T14:31:33.0933760Z #10 CACHED
2026-05-22T14:31:33.0933919Z 
2026-05-22T14:31:33.0934142Z #11 [deps 6/6] RUN pnpm install --frozen-lockfile --ignore-scripts --filter lcbp3-frontend...
2026-05-22T14:31:33.0934388Z #11 CACHED
2026-05-22T14:31:33.0934613Z 
2026-05-22T14:31:33.0934793Z #12 [build  2/10] RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
2026-05-22T14:31:33.0935069Z #12 CACHED
2026-05-22T14:31:33.0935229Z 
2026-05-22T14:31:33.0935452Z #13 [build  3/14] WORKDIR /w
2026-05-22T14:31:33.0935623Z #13 CACHED
2026-05-22T14:31:33.0935838Z 
2026-05-22T14:31:33.0935995Z #14 [deps 3/6] WORKDIR /w
2026-05-22T14:31:33.0936189Z #14 CACHED
2026-05-22T14:31:33.0936364Z 
2026-05-22T14:31:33.0936518Z #15 [build  4/14] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T14:31:33.0936781Z #15 CACHED
2026-05-22T14:31:33.0937006Z 
2026-05-22T14:31:33.0937169Z #16 [build  7/14] COPY --from=deps /w/frontend/node_modules ./node_modules
2026-05-22T14:31:33.1560675Z 
2026-05-22T14:31:33.1561459Z #6 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-22T14:31:33.1561801Z #6 CACHED
2026-05-22T14:31:33.1561972Z 
2026-05-22T14:31:33.1562225Z #7 [build  4/10] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T14:31:33.1562454Z #7 CACHED
2026-05-22T14:31:33.1562702Z 
2026-05-22T14:31:33.1562988Z #8 [build 10/10] RUN find /app/backend-prod/node_modules -name "*.md" -delete     && find /app/backend-prod/node_modules -name "*.txt" -delete     && find /app/backend-prod/node_modules -name "LICENSE*" -delete     && find /app/backend-prod/node_modules -name "README*" -delete     && find /app/backend-prod/node_modules -name "CHANGELOG*" -delete
2026-05-22T14:31:33.1563414Z #8 CACHED
2026-05-22T14:31:33.1563696Z 
2026-05-22T14:31:33.1563857Z #9 [deps 6/6] RUN pnpm install --frozen-lockfile --filter backend...
2026-05-22T14:31:33.1564098Z #9 CACHED
2026-05-22T14:31:33.1564318Z 
2026-05-22T14:31:33.1564553Z #10 [build  5/10] COPY --from=deps /app/node_modules ./node_modules
2026-05-22T14:31:33.1564745Z #10 CACHED
2026-05-22T14:31:33.1564900Z 
2026-05-22T14:31:33.1565137Z #11 [production 6/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/package.json ./
2026-05-22T14:31:33.1565416Z #11 CACHED
2026-05-22T14:31:33.1565603Z 
2026-05-22T14:31:33.1565762Z #12 [production 4/8] RUN addgroup -g 1001 -S nestjs &&     adduser -S nestjs -u 1001
2026-05-22T14:31:33.1566041Z #12 CACHED
2026-05-22T14:31:33.1566203Z 
2026-05-22T14:31:33.1566412Z #13 [build  3/10] WORKDIR /app
2026-05-22T14:31:33.1566591Z #13 CACHED
2026-05-22T14:31:33.1566814Z 
2026-05-22T14:31:33.1566992Z #14 [deps 3/6] WORKDIR /app
2026-05-22T14:31:33.1567211Z #14 CACHED
2026-05-22T14:31:33.1567374Z 
2026-05-22T14:31:33.1567582Z #15 [build  6/10] COPY --from=deps /app/backend/node_modules ./backend/node_modules
2026-05-22T14:31:33.1567779Z #15 CACHED
2026-05-22T14:31:33.1567950Z 
2026-05-22T14:31:33.1568159Z #16 [build  7/10] COPY backend/ ./backend/
2026-05-22T14:31:33.1568415Z #16 CACHED
2026-05-22T14:31:33.1568585Z 
2026-05-22T14:31:33.1568737Z #17 [build  8/10] RUN cd backend &&     NODE_OPTIONS="--max-old-space-size=4096"     pnpm run build
2026-05-22T14:31:33.1568977Z #17 CACHED
2026-05-22T14:31:33.1569194Z 
2026-05-22T14:31:33.1569352Z #18 [production 5/8] COPY --from=build --chown=nestjs:nestjs /app/backend/dist ./dist
2026-05-22T14:31:33.1569546Z #18 CACHED
2026-05-22T14:31:33.1569717Z 
2026-05-22T14:31:33.1569920Z #19 [production 2/8] RUN apk add --no-cache curl
2026-05-22T14:31:33.1570098Z #19 CACHED
2026-05-22T14:31:33.1570269Z 
2026-05-22T14:31:33.1570427Z #20 [build  9/10] RUN PNPM_IGNORE_SCRIPTS=none     pnpm --filter backend deploy --prod --shamefully-hoist --legacy --no-optional /app/backend-prod
2026-05-22T14:31:33.1570680Z #20 CACHED
2026-05-22T14:31:33.1570849Z 
2026-05-22T14:31:33.1571038Z #21 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-22T14:31:33.1571232Z #21 CACHED
2026-05-22T14:31:33.1571404Z 
2026-05-22T14:31:33.1571558Z #*** [deps 5/6] COPY backend/package.json ./backend/
2026-05-22T14:31:33.1571761Z #*** CACHED
2026-05-22T14:31:33.1571930Z 
2026-05-22T14:31:33.1572085Z #23 [production 3/8] WORKDIR /app
2026-05-22T14:31:33.1572268Z #23 CACHED
2026-05-22T14:31:33.1572429Z 
2026-05-22T14:31:33.1572581Z #24 [build  2/10] RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
2026-05-22T14:31:33.1572778Z #24 CACHED
2026-05-22T14:31:33.1572938Z 
2026-05-22T14:31:33.1573088Z #25 [production 7/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/node_modules ./node_modules
2026-05-22T14:31:33.1573390Z #25 CACHED
2026-05-22T14:31:33.1573966Z 
2026-05-22T14:31:33.1574383Z #26 [production 8/8] RUN mkdir -p /app/uploads/temp /app/uploads/permanent &&     chown -R nestjs:nestjs /app/uploads
2026-05-22T14:31:33.2556562Z #16 CACHED
2026-05-22T14:31:33.2557312Z 
2026-05-22T14:31:33.2557625Z #17 [build  8/14] COPY frontend/ ./
2026-05-22T14:31:33.2842062Z #26 CACHED
2026-05-22T14:31:33.2842792Z 
2026-05-22T14:31:33.2842987Z #27 exporting to image
2026-05-22T14:31:33.2843379Z #27 exporting layers done
2026-05-22T14:31:33.4350837Z #27 writing image sha256:5bea8635f5e3d17befa2d42c144ebad76c9586766564a355528cb1cd6c215978
2026-05-22T14:31:33.4464734Z #27 writing image sha256:5bea8635f5e3d17befa2d42c144ebad76c9586766564a355528cb1cd6c215978 0.2s done
2026-05-22T14:31:33.4465623Z #27 naming to docker.io/library/lcbp3-backend:latest
2026-05-22T14:31:33.5729233Z #27 naming to docker.io/library/lcbp3-backend:latest 0.1s done
2026-05-22T14:31:33.5729921Z #27 DONE 0.3s
2026-05-22T14:31:35.9200724Z #17 DONE 2.8s
2026-05-22T14:31:36.0528996Z 
2026-05-22T14:31:36.0529713Z #18 [build  9/14] RUN ls -la /w/frontend/public/ || (echo "WARNING: public directory not found, creating empty one" && mkdir -p /w/frontend/public)
2026-05-22T14:31:38.9154708Z #18 2.862 total 36
2026-05-22T14:31:39.0661783Z #18 2.863 drwxrwxrwx    3 root     root          4096 Apr 19 06:21 .
2026-05-22T14:31:39.0662504Z #18 2.863 drwxr-xr-x    1 root     root          4096 May *** 14:31 ..
2026-05-22T14:31:39.0662755Z #18 2.863 -rw-rw-rw-    1 root     root           130 Apr  1 15:50 favicon.ico
2026-05-22T14:31:39.0662967Z #18 2.863 drwxrwxrwx    4 root     root          4096 Apr 19 06:21 locales
2026-05-22T14:31:39.0663498Z #18 2.863 -rw-rw-rw-    1 root     root           140 Apr  1 15:50 robots.txt
2026-05-22T14:31:40.1471726Z #18 DONE 4.1s
2026-05-22T14:31:40.3797016Z 
2026-05-22T14:31:40.3797774Z #19 [build 10/14] RUN set -e;     MONACO_VS=$(find /w/frontend/node_modules /w/node_modules       -path "*/monaco-editor/min/vs" -type d 2>/dev/null | head -1);     if [ -z "$MONACO_VS" ]; then       echo "ERROR: monaco-editor/min/vs not found in node_modules" && exit 1;     fi;     echo "Found Monaco at: $MONACO_VS";     mkdir -p /w/frontend/public;     cp -rL "$MONACO_VS" /w/frontend/public/monaco-vs;     echo "Monaco assets copied successfully"
2026-05-22T14:31:43.3116017Z #19 3.082 Found Monaco at: /w/node_modules/.pnpm/monaco-editor@0.55.1/node_modules/monaco-editor/min/vs
2026-05-22T14:31:43.6120783Z #19 3.383 Monaco assets copied successfully
2026-05-22T14:31:45.2753063Z #19 DONE 5.0s
2026-05-22T14:31:45.5036793Z 
2026-05-22T14:31:45.5037540Z #20 [build 11/14] RUN mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next
2026-05-22T14:31:47.4727359Z #20 2.119 ! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.33.0.tgz
2026-05-22T14:31:51.6448088Z #20 6.291 
2026-05-22T14:31:51.6448791Z #20 6.291 > lcbp3-frontend@1.8.1 build /w/frontend
2026-05-22T14:31:51.6449013Z #20 6.291 > next build
2026-05-22T14:31:51.6449190Z #20 6.291 
2026-05-22T14:31:53.5664587Z #20 8.213 ▲ Next.js 16.2.6 (Turbopack)
2026-05-22T14:31:53.8064979Z #20 8.214 
2026-05-22T14:31:53.8065702Z #20 8.303   Creating an optimized production build ...
2026-05-22T14:32:16.8179163Z #20 31.46 ✓ Compiled successfully in ***.5s
2026-05-22T14:32:17.0198520Z #20 31.52   Running TypeScript ...
2026-05-22T14:32:41.5943978Z #20 56.24   Finished TypeScript in 24.7s ...
2026-05-22T14:32:41.7492779Z #20 56.24   Collecting page data using 7 workers ...
2026-05-22T14:32:43.5277902Z #20 58.17   Generating static pages using 7 workers (0/44) ...
2026-05-22T14:32:44.0331370Z #20 58.68   Generating static pages using 7 workers (11/44) 
2026-05-22T14:32:44.1486456Z #20 58.79   Generating static pages using 7 workers (***/44) 
2026-05-22T14:32:44.2568299Z #20 58.90   Generating static pages using 7 workers (33/44) 
2026-05-22T14:32:44.3895291Z #20 59.04 ✓ Generating static pages using 7 workers (44/44) in 862ms
2026-05-22T14:32:44.6105857Z #20 59.07   Finalizing page optimization ...
2026-05-22T14:32:44.6106652Z #20 59.09 
2026-05-22T14:32:44.6106889Z #20 59.11 Route (app)
2026-05-22T14:32:44.6107270Z #20 59.11 ┌ ƒ /
2026-05-22T14:32:44.6107625Z #20 59.11 ├ ƒ /_not-found
2026-05-22T14:32:44.6107986Z #20 59.11 ├ ƒ /***
2026-05-22T14:32:44.6108200Z #20 59.11 ├ ƒ /***/access-control/organizations
2026-05-22T14:32:44.6108503Z #20 59.11 ├ ƒ /***/access-control/roles
2026-05-22T14:32:44.6108809Z #20 59.11 ├ ƒ /***/access-control/users
2026-05-22T14:32:44.6109012Z #20 59.11 ├ ƒ /***/ai
2026-05-22T14:32:44.6109249Z #20 59.11 ├ ƒ /***/ai/intent-classification
2026-05-22T14:32:44.6109557Z #20 59.11 ├ ƒ /***/ai/intent-classification/[intentCode]
2026-05-22T14:32:44.6109811Z #20 59.11 ├ ƒ /***/ai/intent-classification/analytics
2026-05-22T14:32:44.6110048Z #20 59.11 ├ ƒ /***/ai/intent-classification/test-console
2026-05-22T14:32:44.6110366Z #20 59.11 ├ ƒ /***/audit-logs
2026-05-22T14:32:44.6110614Z #20 59.11 ├ ƒ /***/doc-control/contracts
2026-05-22T14:32:44.6110809Z #20 59.11 ├ ƒ /***/doc-control/drawings
2026-05-22T14:32:44.6111064Z #20 59.11 ├ ƒ /***/doc-control/drawings/contract/categories
2026-05-22T14:32:44.6111275Z #20 59.11 ├ ƒ /***/doc-control/drawings/contract/sub-categories
2026-05-22T14:32:44.6111495Z #20 59.11 ├ ƒ /***/doc-control/drawings/contract/volumes
2026-05-22T14:32:44.6111793Z #20 59.11 ├ ƒ /***/doc-control/drawings/shop/main-categories
2026-05-22T14:32:44.6112089Z #20 59.11 ├ ƒ /***/doc-control/drawings/shop/sub-categories
2026-05-22T14:32:44.6112419Z #20 59.11 ├ ƒ /***/doc-control/numbering
2026-05-22T14:32:44.6112672Z #20 59.11 ├ ƒ /***/doc-control/numbering/[id]/edit
2026-05-22T14:32:44.6112927Z #20 59.11 ├ ƒ /***/doc-control/numbering/new
2026-05-22T14:32:44.6113131Z #20 59.11 ├ ƒ /***/doc-control/projects
2026-05-22T14:32:44.6113455Z #20 59.11 ├ ƒ /***/doc-control/reference
2026-05-22T14:32:44.6113709Z #20 59.11 ├ ƒ /***/doc-control/reference/correspondence-types
2026-05-22T14:32:44.6113956Z #20 59.11 ├ ƒ /***/doc-control/reference/disciplines
2026-05-22T14:32:44.6114150Z #20 59.11 ├ ƒ /***/doc-control/reference/drawing-categories
2026-05-22T14:32:44.6114396Z #20 59.11 ├ ƒ /***/doc-control/reference/rfa-types
2026-05-22T14:32:44.6117207Z #20 59.11 ├ ƒ /***/doc-control/reference/tags
2026-05-22T14:32:44.6117651Z #20 59.11 ├ ƒ /***/doc-control/workflows
2026-05-22T14:32:44.6117878Z #20 59.11 ├ ƒ /***/doc-control/workflows/[id]/edit
2026-05-22T14:32:44.6118154Z #20 59.11 ├ ƒ /***/doc-control/workflows/new
2026-05-22T14:32:44.6118516Z #20 59.11 ├ ƒ /***/migration
2026-05-22T14:32:44.6119006Z #20 59.11 ├ ƒ /***/migration/errors
2026-05-22T14:32:44.6119302Z #20 59.11 ├ ƒ /***/migration/review/[id]
2026-05-22T14:32:44.6119508Z #20 59.11 ├ ƒ /***/monitoring/audit-logs
2026-05-22T14:32:44.6119771Z #20 59.11 ├ ƒ /***/monitoring/sessions
2026-05-22T14:32:44.6119969Z #20 59.11 ├ ƒ /***/monitoring/system-logs/numbering
2026-05-22T14:32:44.6120233Z #20 59.11 ├ ƒ /***/numbering
2026-05-22T14:32:44.6120445Z #20 59.11 ├ ƒ /***/numbering/[id]/edit
2026-05-22T14:32:44.6120714Z #20 59.11 ├ ƒ /***/numbering/new
2026-05-22T14:32:44.6120914Z #20 59.11 ├ ƒ /***/organizations
2026-05-22T14:32:44.6121163Z #20 59.11 ├ ƒ /***/settings
2026-05-22T14:32:44.6121349Z #20 59.11 ├ ƒ /***/users
2026-05-22T14:32:44.6121569Z #20 59.11 ├ ƒ /***/workflows
2026-05-22T14:32:44.6121759Z #20 59.11 ├ ƒ /***/workflows/[id]/edit
2026-05-22T14:32:44.6122231Z #20 59.11 ├ ƒ /***/workflows/new
2026-05-22T14:32:44.6122540Z #20 59.11 ├ ƒ /ai-staging
2026-05-22T14:32:44.6122972Z #20 59.11 ├ ƒ /api/ai/chat
2026-05-22T14:32:44.6123463Z #20 59.11 ├ ƒ /api/auth/[...nextauth]
2026-05-22T14:32:44.6123811Z #20 59.11 ├ ƒ /circulation
2026-05-22T14:32:44.6123989Z #20 59.11 ├ ƒ /circulation/[uuid]
2026-05-22T14:32:44.6124169Z #20 59.11 ├ ƒ /circulation/new
2026-05-22T14:32:44.6124459Z #20 59.11 ├ ƒ /correspondences
2026-05-22T14:32:44.6124757Z #20 59.11 ├ ƒ /correspondences/[uuid]
2026-05-22T14:32:44.6124943Z #20 59.11 ├ ƒ /correspondences/[uuid]/edit
2026-05-22T14:32:44.6125216Z #20 59.11 ├ ƒ /correspondences/new
2026-05-22T14:32:44.6125574Z #20 59.11 ├ ƒ /dashboard
2026-05-22T14:32:44.6125778Z #20 59.11 ├ ƒ /delegation
2026-05-22T14:32:44.6125999Z #20 59.11 ├ ƒ /distribution-matrices
2026-05-22T14:32:44.6126628Z #20 59.11 ├ ƒ /drawings
2026-05-22T14:32:44.6126950Z #20 59.11 ├ ƒ /drawings/[uuid]
2026-05-22T14:32:44.6127204Z #20 59.11 ├ ƒ /drawings/upload
2026-05-22T14:32:44.6127452Z #20 59.11 ├ ƒ /login
2026-05-22T14:32:44.6127642Z #20 59.11 ├ ƒ /migration/review
2026-05-22T14:32:44.6127890Z #20 59.11 ├ ƒ /profile
2026-05-22T14:32:44.6128152Z #20 59.11 ├ ƒ /projects
2026-05-22T14:32:44.6128357Z #20 59.11 ├ ƒ /projects/new
2026-05-22T14:32:44.6128604Z #20 59.11 ├ ƒ /rag
2026-05-22T14:32:44.6128797Z #20 59.11 ├ ƒ /response-codes
2026-05-22T14:32:44.6129037Z #20 59.11 ├ ƒ /rfa
2026-05-22T14:32:44.6129210Z #20 59.11 ├ ƒ /rfas
2026-05-22T14:32:44.6129388Z #20 59.11 ├ ƒ /rfas/[uuid]
2026-05-22T14:32:44.6129616Z #20 59.11 ├ ƒ /rfas/[uuid]/edit
2026-05-22T14:32:44.6129998Z #20 59.11 ├ ƒ /rfas/new
2026-05-22T14:32:44.6130187Z #20 59.11 ├ ƒ /search
2026-05-22T14:32:44.6130365Z #20 59.11 ├ ƒ /settings
2026-05-22T14:32:44.6130681Z #20 59.11 ├ ƒ /settings/delegation
2026-05-22T14:32:44.6131093Z #20 59.11 ├ ƒ /settings/reminder-rules
2026-05-22T14:32:44.6131335Z #20 59.11 ├ ƒ /settings/review-teams
2026-05-22T14:32:44.6131630Z #20 59.11 ├ ƒ /transmittals
2026-05-22T14:32:44.6131921Z #20 59.11 ├ ƒ /transmittals/[uuid]
2026-05-22T14:32:44.6132110Z #20 59.11 └ ƒ /transmittals/new
2026-05-22T14:32:44.6132342Z #20 59.11 
2026-05-22T14:32:44.6132746Z #20 59.11 
2026-05-22T14:32:44.6132929Z #20 59.11 ƒ Proxy (Middleware)
2026-05-22T14:32:44.6133115Z #20 59.11 
2026-05-22T14:32:44.6133510Z #20 59.11 ƒ  (Dynamic)  server-rendered on demand
2026-05-22T14:32:44.6133793Z #20 59.11 
2026-05-22T14:32:46.2699951Z #20 DONE 60.9s
2026-05-22T14:32:46.4102340Z 
2026-05-22T14:32:46.4103089Z #21 [build 12/14] RUN ls -la /w/frontend/.next/ || (echo "ERROR: Build not found!" && exit 1)
2026-05-22T14:32:48.1291853Z #21 1.719 total 296
2026-05-22T14:32:48.2797390Z #21 1.719 drwxr-xr-x    8 root     root          4096 May *** 14:32 .
2026-05-22T14:32:48.2798197Z #21 1.719 drwxr-xr-x    1 root     root          4096 May *** 14:32 ..
2026-05-22T14:32:48.2798486Z #21 1.719 -rw-r--r--    1 root     root            21 May *** 14:32 BUILD_ID
2026-05-22T14:32:48.2798752Z #21 1.719 -rw-r--r--    1 root     root          5872 May *** 14:32 app-path-routes-manifest.json
2026-05-22T14:32:48.2799046Z #21 1.719 drwxr-xr-x    3 root     root          4096 May *** 14:31 build
2026-05-22T14:32:48.2799310Z #21 1.719 -rw-r--r--    1 root     root           541 May *** 14:32 build-manifest.json
2026-05-22T14:32:48.2799557Z #21 1.719 drwxr-xr-x    2 root     root          4096 May *** 14:32 cache
2026-05-22T14:32:48.2799759Z #21 1.719 drwxr-xr-x    2 root     root          4096 May *** 14:32 diagnostics
2026-05-22T14:32:48.2800011Z #21 1.719 -rw-r--r--    1 root     root           111 May *** 14:32 export-marker.json
2026-05-22T14:32:48.2800247Z #21 1.719 -rw-r--r--    1 root     root           299 May *** 14:32 fallback-build-manifest.json
2026-05-22T14:32:48.2800542Z #21 1.719 -rw-r--r--    1 root     root          1415 May *** 14:32 images-manifest.json
2026-05-22T14:32:48.2800767Z #21 1.719 -rw-rw-r--    1 root     root         20753 May *** 14:32 next-minimal-server.js.nft.json
2026-05-22T14:32:48.2801028Z #21 1.719 -rw-rw-r--    1 root     root        119347 May *** 14:32 next-server.js.nft.json
2026-05-22T14:32:48.2801332Z #21 1.719 -rw-r--r--    1 root     root            20 May *** 14:31 package.json
2026-05-22T14:32:48.2801613Z #21 1.719 -rw-r--r--    1 root     root          1831 May *** 14:32 prerender-manifest.json
2026-05-22T14:32:48.2801821Z #21 1.719 -rw-r--r--    1 root     root          9252 May *** 14:32 required-server-files.js
2026-05-22T14:32:48.2802126Z #21 1.719 -rw-r--r--    1 root     root          9***3 May *** 14:32 required-server-files.json
2026-05-22T14:32:48.2802401Z #21 1.719 -rw-r--r--    1 root     root         17818 May *** 14:32 routes-manifest.json
2026-05-22T14:32:48.2802601Z #21 1.719 drwxr-xr-x    6 root     root          4096 May *** 14:32 server
2026-05-22T14:32:48.2802816Z #21 1.719 drwxr-xr-x    5 root     root          4096 May *** 14:32 static
2026-05-22T14:32:48.2803063Z #21 1.719 -rw-r--r--    1 root     root         33514 May *** 14:32 trace
2026-05-22T14:32:48.2803459Z #21 1.719 -rw-r--r--    1 root     root          1205 May *** 14:32 trace-build
2026-05-22T14:32:48.2803675Z #21 1.719 -rw-r--r--    1 root     root             0 May *** 14:31 turbopack
2026-05-22T14:32:48.2803910Z #21 1.719 drwxr-xr-x    2 root     root          4096 May *** 14:31 types
2026-05-22T14:32:49.6071565Z #21 DONE 3.2s
2026-05-22T14:32:49.7436790Z 
2026-05-22T14:32:49.7437528Z #*** [build 13/14] WORKDIR /w
2026-05-22T14:32:51.4087085Z #*** DONE 1.7s
2026-05-22T14:32:51.6099465Z 
2026-05-22T14:32:51.6100253Z #23 [build 14/14] RUN pnpm --filter lcbp3-frontend deploy /deploy --prod --legacy
2026-05-22T14:32:54.9028279Z #23 3.443  WARN  Shared workspace lockfile detected but configuration forces legacy deploy implementation.
2026-05-22T14:32:55.0580292Z #23 3.598 Packages are copied from the content-addressable store to the virtual store.
2026-05-22T14:32:55.0581060Z #23 3.598   Content-addressable store is at: /root/.local/share/pnpm/store/v10
2026-05-22T14:32:55.0581288Z #23 3.598   Virtual store is at:             ../deploy/node_modules/.pnpm
2026-05-22T14:32:55.4946623Z #23 4.035 Progress: resolved 0, reused 0, downloaded 1, added 0
2026-05-22T14:32:56.4977315Z #23 5.038 Progress: resolved 49, reused 0, downloaded 49, added 0
2026-05-22T14:32:57.4973469Z #23 6.038 Progress: resolved 62, reused 0, downloaded 62, added 0
2026-05-22T14:32:58.5919735Z #23 7.132 Progress: resolved 62, reused 0, downloaded 63, added 0
2026-05-22T14:32:59.5925023Z #23 8.133 Progress: resolved 65, reused 0, downloaded 65, added 0
2026-05-22T14:33:00.5930572Z #23 9.133 Progress: resolved 66, reused 0, downloaded 66, added 0
2026-05-22T14:33:01.6233518Z #23 10.16 Progress: resolved 66, reused 0, downloaded 67, added 0
2026-05-22T14:33:02.6239215Z #23 11.16 Progress: resolved 67, reused 0, downloaded 67, added 0
2026-05-22T14:33:18.9589343Z #23 27.50 Progress: resolved 67, reused 0, downloaded 68, added 0
2026-05-22T14:33:19.9780644Z #23 28.52 Progress: resolved 88, reused 0, downloaded 84, added 0
2026-05-22T14:33:21.0572484Z #23 29.60 Progress: resolved 124, reused 0, downloaded 114, added 0
2026-05-22T14:33:22.0572952Z #23 30.60 Progress: resolved 219, reused 0, downloaded 209, added 0
2026-05-22T14:33:23.0578112Z #23 31.60 Progress: resolved 315, reused 0, downloaded 306, added 0
2026-05-22T14:33:24.0584979Z #23 32.60 Progress: resolved 461, reused 0, downloaded 452, added 0
2026-05-22T14:33:25.0600260Z #23 33.60 Progress: resolved 635, reused 0, downloaded 580, added 0
2026-05-22T14:33:26.0600618Z #23 34.60 Progress: resolved 689, reused 0, downloaded 616, added 0
2026-05-22T14:33:27.0593333Z #23 35.60 Progress: resolved 716, reused 0, downloaded 635, added 0
2026-05-22T14:33:28.0596294Z #23 36.60 Progress: resolved 716, reused 0, downloaded 636, added 0
2026-05-22T14:33:48.9910752Z #23 57.53  WARN  Tarball download average speed 14 KiB/s (size 401 KiB) is below 50 KiB/s: https://registry.npmjs.org/eslint-plugin-import/-/eslint-plugin-import-2.32.0.tgz (GET)
2026-05-22T14:33:49.1481619Z #23 57.54 Progress: resolved 716, reused 0, downloaded 637, added 0
2026-05-22T14:33:49.9970848Z #23 58.54 Progress: resolved 751, reused 0, downloaded 670, added 0
2026-05-22T14:33:50.9956612Z #23 59.54 Progress: resolved 770, reused 0, downloaded 672, added 0
2026-05-22T14:33:51.9980323Z #23 60.54 Progress: resolved 772, reused 0, downloaded 675, added 0
2026-05-22T14:33:52.9986634Z #23 61.54 Progress: resolved 776, reused 0, downloaded 676, added 0
2026-05-22T14:33:53.9982702Z #23 62.54 Progress: resolved 785, reused 0, downloaded 685, added 0
2026-05-22T14:33:54.9980087Z #23 63.54 Progress: resolved 793, reused 0, downloaded 691, added 0
2026-05-22T14:33:56.0029446Z #23 64.54 Progress: resolved 818, reused 0, downloaded 705, added 0
2026-05-22T14:33:57.0034806Z #23 65.54 Progress: resolved 823, reused 0, downloaded 713, added 0
2026-05-22T14:33:57.4171254Z #23 65.96 .                                        | +311 +++++++++++++++++++++++++++++++
2026-05-22T14:33:58.0020918Z #23 66.54 Progress: resolved 823, reused 0, downloaded 714, added 157
2026-05-22T14:33:59.0023727Z #23 67.54 Progress: resolved 823, reused 0, downloaded 715, added 310
2026-05-22T14:34:02.2245485Z #23 70.76 Progress: resolved 823, reused 0, downloaded 716, added 310
2026-05-22T14:34:02.3567559Z #23 70.90 Progress: resolved 823, reused 0, downloaded 716, added 311, done
2026-05-22T14:34:02.5239999Z #23 71.06 .../sharp@0.34.5/node_modules/sharp install$ node install/check.js || npm run build
2026-05-22T14:34:02.6575675Z #23 71.20 .../sharp@0.34.5/node_modules/sharp install: Done
2026-05-22T14:34:02.7606745Z #23 71.30  WARN  Failed to create bin at /deploy/node_modules/.pnpm/tailwindcss-animate@1.0.7_tailwindcss@3.4.3_ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3__/node_modules/tailwindcss-animate/node_modules/.bin/tailwind. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/tailwindcss@3.4.3_ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3_/node_modules/tailwindcss/lib/cli.js'
2026-05-22T14:34:02.9583991Z #23 71.30  WARN  Failed to create bin at /deploy/node_modules/.pnpm/tailwindcss-animate@1.0.7_tailwindcss@3.4.3_ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3__/node_modules/tailwindcss-animate/node_modules/.bin/tailwindcss. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/tailwindcss@3.4.3_ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3_/node_modules/tailwindcss/lib/cli.js'
2026-05-22T14:34:02.9584852Z #23 71.30  WARN  Failed to create bin at /deploy/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/node_modules/.bin/tsc. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc'
2026-05-22T14:34:02.9585192Z #23 71.30  WARN  Failed to create bin at /deploy/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/node_modules/.bin/tsserver. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsserver'
2026-05-22T14:34:02.9585486Z #23 71.35  WARN  Failed to create bin at /w/deploy/node_modules/.bin/acorn. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/acorn@8.15.0/node_modules/acorn/bin/acorn'
2026-05-22T14:34:02.9585862Z #23 71.35  WARN  Failed to create bin at /w/deploy/node_modules/.bin/jiti. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/jiti@2.6.1/node_modules/jiti/lib/jiti-cli.mjs'
2026-05-22T14:34:02.9586097Z #23 71.35  WARN  Failed to create bin at /w/deploy/node_modules/.bin/terser. ENOENT: no such file or directory, open '/deploy/node_modules/.pnpm/terser@5.44.1/node_modules/terser/bin/terser'
2026-05-22T14:34:03.2510579Z #23 71.79 . prepare$ husky
2026-05-22T14:34:03.4273219Z #23 71.82 frontend postinstall$ npm run copy-monaco-assets
2026-05-22T14:34:03.4418384Z #23 71.98 . prepare: .git can't be found
2026-05-22T14:34:03.5930485Z #23 71.98 . prepare: Done
2026-05-22T14:34:05.6595620Z #23 74.20 frontend postinstall: npm warn config production Use `--omit=dev` instead.
2026-05-22T14:34:05.8337754Z #23 74.*** frontend postinstall: npm warn Unknown env config "verify-deps-before-run". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
2026-05-22T14:34:05.8339209Z #23 74.*** frontend postinstall: npm warn Unknown env config "npm-globalconfig". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
2026-05-22T14:34:05.8339466Z #23 74.*** frontend postinstall: npm warn Unknown env config "recursive". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
2026-05-22T14:34:05.8339696Z #23 74.*** frontend postinstall: npm warn Unknown env config "_jsr-registry". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
2026-05-22T14:34:05.8339975Z #23 74.*** frontend postinstall: npm warn Unknown env config "force-legacy-deploy". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
2026-05-22T14:34:06.3082508Z #23 74.85 frontend postinstall: > lcbp3-frontend@1.8.1 copy-monaco-assets
2026-05-22T14:34:06.4220613Z #23 74.85 frontend postinstall: > node -e "const fs=require('fs');const path=require('path');const dst='public/monaco-vs';try{const pkgJson=require.resolve('monaco-editor/package.json');const src=path.join(path.dirname(pkgJson),'min','vs');if(!fs.existsSync(dst)){fs.cpSync(src,dst,{recursive:true});console.log('Monaco assets copied from: '+src)}else{console.log('Monaco assets already exist')}}catch(e){console.warn('WARNING: monaco-editor not found, skipping copy. Run after npm install.');process.exit(0)}"
2026-05-22T14:34:06.4221552Z #23 74.92 frontend postinstall: WARNING: monaco-editor not found, skipping copy. Run after npm install.
2026-05-22T14:34:06.4221843Z #23 74.96 frontend postinstall: Done
2026-05-22T14:34:06.5792121Z #23 74.97  WARN  Issues with peer dependencies found
2026-05-22T14:34:06.5792869Z #23 74.97 frontend
2026-05-22T14:34:06.5793080Z #23 74.97 └─┬ @vitest/coverage-v8 4.1.6
2026-05-22T14:34:06.5793483Z #23 74.97   └── ✕ unmet peer vitest@4.1.6: found 4.1.0
2026-05-22T14:34:10.5240923Z #23 DONE 79.1s
2026-05-22T14:34:16.5408227Z 
2026-05-22T14:34:16.5408971Z #24 [production 2/9] WORKDIR /app
2026-05-22T14:34:16.5409338Z #24 CACHED
2026-05-22T14:34:16.5409626Z 
2026-05-22T14:34:16.5409803Z #25 [production 3/9] RUN addgroup -g 1001 -S nextjs &&     adduser -S nextjs -u 1001
2026-05-22T14:34:16.5410073Z #25 CACHED
2026-05-22T14:34:16.5410310Z 
2026-05-22T14:34:16.5410543Z #26 [production 4/9] RUN apk add --no-cache curl
2026-05-22T14:34:16.5410746Z #26 CACHED
2026-05-22T14:34:16.6912059Z 
2026-05-22T14:34:16.6912880Z #27 [production 5/9] COPY --from=build --chown=nextjs:nextjs /deploy/node_modules ./node_modules
2026-05-22T14:34:33.7070759Z #27 DONE 17.2s
2026-05-22T14:34:33.8181859Z 
2026-05-22T14:34:33.8182658Z #28 [production 6/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/.next ./.next
2026-05-22T14:34:37.9682966Z #28 DONE 4.2s
2026-05-22T14:34:38.1604554Z 
2026-05-22T14:34:38.1605261Z #29 [production 7/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/public ./public
2026-05-22T14:34:40.0916980Z #29 DONE 2.1s
2026-05-22T14:34:40.3086417Z 
2026-05-22T14:34:40.3087179Z #30 [production 8/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/package.json ./
2026-05-22T14:34:41.9159236Z #30 DONE 1.8s
2026-05-22T14:34:42.1633641Z 
2026-05-22T14:34:42.1634480Z #31 [production 9/9] RUN ls -la ./node_modules/next/dist/bin/next && ls -la ./.next/ && ls -la ./public/ || (echo "ERROR: Required files not found!" && exit 1)
2026-05-22T14:34:43.8014514Z #31 1.789 -rwxr-xr-x    1 nextjs   nextjs       17023 May *** 14:33 ./node_modules/next/dist/bin/next
2026-05-22T14:34:43.9544629Z #31 1.790 total 296
2026-05-22T14:34:43.9545377Z #31 1.790 drwxr-xr-x    8 nextjs   nextjs        4096 May *** 14:32 .
2026-05-22T14:34:43.9545646Z #31 1.790 drwxr-xr-x    1 root     root          4096 May *** 14:34 ..
2026-05-22T14:34:43.9545897Z #31 1.790 -rw-r--r--    1 nextjs   nextjs          21 May *** 14:32 BUILD_ID
2026-05-22T14:34:43.9546115Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        5872 May *** 14:32 app-path-routes-manifest.json
2026-05-22T14:34:43.9546403Z #31 1.790 drwxr-xr-x    3 nextjs   nextjs        4096 May *** 14:31 build
2026-05-22T14:34:43.9546746Z #31 1.790 -rw-r--r--    1 nextjs   nextjs         541 May *** 14:32 build-manifest.json
2026-05-22T14:34:43.9546976Z #31 1.790 drwxr-xr-x    2 nextjs   nextjs        4096 May *** 14:32 cache
2026-05-22T14:34:43.9547197Z #31 1.790 drwxr-xr-x    2 nextjs   nextjs        4096 May *** 14:32 diagnostics
2026-05-22T14:34:43.9547437Z #31 1.790 -rw-r--r--    1 nextjs   nextjs         111 May *** 14:32 export-marker.json
2026-05-22T14:34:43.9547729Z #31 1.790 -rw-r--r--    1 nextjs   nextjs         299 May *** 14:32 fallback-build-manifest.json
2026-05-22T14:34:43.9548005Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        1415 May *** 14:32 images-manifest.json
2026-05-22T14:34:43.9548219Z #31 1.790 -rw-rw-r--    1 nextjs   nextjs       20753 May *** 14:32 next-minimal-server.js.nft.json
2026-05-22T14:34:43.9548519Z #31 1.790 -rw-rw-r--    1 nextjs   nextjs      119347 May *** 14:32 next-server.js.nft.json
2026-05-22T14:34:43.9548811Z #31 1.790 -rw-r--r--    1 nextjs   nextjs          20 May *** 14:31 package.json
2026-05-22T14:34:43.9549040Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        1831 May *** 14:32 prerender-manifest.json
2026-05-22T14:34:43.9549328Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        9252 May *** 14:32 required-server-files.js
2026-05-22T14:34:43.9549616Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        9***3 May *** 14:32 required-server-files.json
2026-05-22T14:34:43.9549854Z #31 1.790 -rw-r--r--    1 nextjs   nextjs       17818 May *** 14:32 routes-manifest.json
2026-05-22T14:34:43.9550081Z #31 1.790 drwxr-xr-x    6 nextjs   nextjs        4096 May *** 14:32 server
2026-05-22T14:34:43.9550382Z #31 1.790 drwxr-xr-x    5 nextjs   nextjs        4096 May *** 14:32 static
2026-05-22T14:34:43.9550636Z #31 1.790 -rw-r--r--    1 nextjs   nextjs       33514 May *** 14:32 trace
2026-05-22T14:34:43.9550946Z #31 1.790 -rw-r--r--    1 nextjs   nextjs        1205 May *** 14:32 trace-build
2026-05-22T14:34:43.9551212Z #31 1.790 -rw-r--r--    1 nextjs   nextjs           0 May *** 14:31 turbopack
2026-05-22T14:34:43.9551439Z #31 1.790 drwxr-xr-x    2 nextjs   nextjs        4096 May *** 14:31 types
2026-05-22T14:34:43.9551696Z #31 1.791 total 40
2026-05-22T14:34:43.9551870Z #31 1.791 drwxr-xr-x    4 nextjs   nextjs        4096 May *** 14:31 .
2026-05-22T14:34:43.9552080Z #31 1.791 drwxr-xr-x    1 root     root          4096 May *** 14:34 ..
2026-05-22T14:34:43.9552304Z #31 1.791 -rw-rw-rw-    1 nextjs   nextjs         130 Apr  1 15:50 favicon.ico
2026-05-22T14:34:43.9552551Z #31 1.791 drwxrwxrwx    4 nextjs   nextjs        4096 Apr 19 06:21 locales
2026-05-22T14:34:43.9552755Z #31 1.791 drwxr-xr-x    6 nextjs   nextjs        4096 May *** 14:31 monaco-vs
2026-05-22T14:34:43.9552950Z #31 1.791 -rw-rw-rw-    1 nextjs   nextjs         140 Apr  1 15:50 robots.txt
2026-05-22T14:34:44.8226434Z #31 DONE 2.8s
2026-05-22T14:34:45.0451187Z 
2026-05-22T14:34:45.0451912Z #32 exporting to image
2026-05-22T14:34:45.0452135Z #32 exporting layers
2026-05-22T14:34:58.4469103Z #32 exporting layers 13.4s done
2026-05-22T14:34:58.6245491Z #32 writing image sha256:75847d8829e82ed79d31ff0533fce99becaa9e8a7ad4915645949214689de718 0.0s done
2026-05-22T14:34:58.6246304Z #32 naming to docker.io/library/lcbp3-frontend:latest 0.1s done
2026-05-22T14:34:58.8007457Z #32 DONE 13.8s
2026-05-22T14:35:00.4845278Z ✓ Images built
2026-05-22T14:35:00.4846035Z [2/3] Starting application stack...
2026-05-22T14:35:00.8896428Z  Container clamav  Recreate
2026-05-22T14:35:05.2427636Z  Container clamav  Recreated
2026-05-22T14:35:05.2428396Z  Container backend  Recreate
2026-05-22T14:35:18.6824257Z  Container backend  Recreated
2026-05-22T14:35:18.6825001Z  Container frontend  Recreate
2026-05-22T14:35:21.2676698Z  Container frontend  Recreated
2026-05-22T14:35:21.2703906Z  Container clamav  Starting
2026-05-22T14:35:22.8308721Z  Container clamav  Started
2026-05-22T14:35:22.8312521Z  Container clamav  Waiting
2026-05-22T14:36:26.3339478Z  Container clamav  Healthy
2026-05-22T14:36:26.3340534Z  Container backend  Starting
2026-05-22T14:36:27.8201051Z  Container backend  Started
2026-05-22T14:36:27.8201772Z  Container backend  Waiting
2026-05-22T14:36:38.6525275Z  Container backend  Error
2026-05-22T14:36:38.6526046Z dependency failed to start: container backend is unhealthy
2026-05-22T14:36:38.6706558Z   ❌  Failure - Main 🚀 Deploy to QNAP
2026-05-22T14:36:38.6822463Z exitcode '1': failure
2026-05-22T14:36:38.7156544Z evaluating expression 'always()'
2026-05-22T14:36:38.7157366Z expression 'always()' evaluated to 'true'
2026-05-22T14:36:38.7157590Z ⭐ Run Post  Checkout
2026-05-22T14:36:38.7157914Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-22T14:36:38.7158207Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-22T14:36:38.7158456Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-22T14:36:38.7158676Z Writing entry to tarball workflow/envs.txt len:0
2026-05-22T14:36:38.7158887Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-22T14:36:38.7159114Z Extracting content to '/var/run/act'
2026-05-22T14:36:38.7195687Z run post step for ' Checkout'
2026-05-22T14:36:38.7196915Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-22T14:36:38.7197208Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-22T14:36:38.7197462Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-22T14:36:38.7198204Z Working directory '/workspace/np-dms/lcbp3'
2026-05-22T14:36:39.0100030Z [command]/usr/bin/git version
2026-05-22T14:36:39.0174408Z git version 2.30.2
2026-05-22T14:36:39.0227914Z ***
2026-05-22T14:36:39.0258821Z Temporarily overriding HOME='/tmp/7ea5cee1-6756-4c24-b93b-4bbd44dd1f0a' before making global git config changes
2026-05-22T14:36:39.0260497Z Adding repository directory to the temporary git global config as a safe directory
2026-05-22T14:36:39.0273074Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-22T14:36:39.0351448Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-22T14:36:39.0418635Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-22T14:36:39.0923570Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-22T14:36:39.0971362Z http.https://git.np-dms.work/.extraheader
2026-05-22T14:36:39.0992373Z [command]/usr/bin/git config --local --unset-all http.https://git.np-dms.work/.extraheader
2026-05-22T14:36:39.1065880Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-22T14:36:39.1569881Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-22T14:36:39.1635610Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-22T14:36:39.2306318Z   ✅  Success - Post  Checkout
2026-05-22T14:36:39.2426842Z Cleaning up container for job deploy
2026-05-22T14:36:40.7622336Z Removed container: 0877d84d997c7728dbdff6e4e6e5be3bf8c2302dbcf8faadbad207e08355babd
2026-05-22T14:36:40.7637594Z   🐳  docker volume rm GITEA-ACTIONS-TASK-502_WORKFLOW-CI-CD-Pipeline_JOB-deploy
2026-05-22T14:36:41.0140075Z   🐳  docker volume rm GITEA-ACTIONS-TASK-502_WORKFLOW-CI-CD-Pipeline_JOB-deploy-env
2026-05-22T14:36:41.2376603Z 🏁  Job failed
2026-05-22T14:36:41.2480723Z Job 'deploy' failed
