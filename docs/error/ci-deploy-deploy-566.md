2026-05-30T01:48:27.4774417Z asustor-runner(version:v0.4.0) received task 566 of job deploy, be triggered by event: push
2026-05-30T01:48:27.4779025Z workflow prepared
2026-05-30T01:48:27.4779753Z evaluating expression 'success()'
2026-05-30T01:48:27.4780840Z expression 'success()' evaluated to 'true'
2026-05-30T01:48:27.4781044Z 'runs-on' key not defined in CI / CD Pipeline/build
2026-05-30T01:48:27.4781189Z No steps found
2026-05-30T01:48:27.4782198Z evaluating expression 'github.ref == 'refs/heads/main''
2026-05-30T01:48:27.4782878Z expression 'github.ref == 'refs/heads/main'' evaluated to 'true'
2026-05-30T01:48:27.4783159Z 🚀  Start image=node:18-bullseye
2026-05-30T01:48:27.4888671Z   🐳  docker pull image=node:18-bullseye platform= username= forcePull=false
2026-05-30T01:48:27.4889336Z   🐳  docker pull node:18-bullseye
2026-05-30T01:48:27.4911355Z Image exists? true
2026-05-30T01:48:27.4990731Z   🐳  docker create image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-30T01:48:32.9345798Z Created container name=GITEA-ACTIONS-TASK-566_WORKFLOW-CI-CD-Pipeline_JOB-deploy id=b362ab9832bf7d7ef35fb50af8308f9512388815d7b2e2f2d4189961bd162f73 from image node:18-bullseye (platform: )
2026-05-30T01:48:32.9346398Z ENV ==> [RUNNER_TOOL_CACHE=/opt/hostedtoolcache RUNNER_OS=Linux RUNNER_ARCH=X64 RUNNER_TEMP=/tmp LANG=C.UTF-8]
2026-05-30T01:48:32.9346604Z   🐳  docker run image=node:18-bullseye platform= entrypoint=["/bin/sleep" "10800"] cmd=[] network="bridge"
2026-05-30T01:48:32.9346831Z Starting container: b362ab9832bf7d7ef35fb50af8308f9512388815d7b2e2f2d4189961bd162f73
2026-05-30T01:48:34.7249417Z Started container: b362ab9832bf7d7ef35fb50af8308f9512388815d7b2e2f2d4189961bd162f73
2026-05-30T01:48:34.8849109Z Writing entry to tarball workflow/event.json len:4627
2026-05-30T01:48:34.8851936Z Writing entry to tarball workflow/envs.txt len:0
2026-05-30T01:48:34.8854859Z Extracting content to '/var/run/act/'
2026-05-30T01:48:34.9099125Z   ☁  git clone 'https://github.com/actions/checkout' # ref=v4
2026-05-30T01:48:34.9099638Z   cloning https://github.com/actions/checkout to /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-30T01:48:36.5004547Z Non-terminating error while running 'git clone': some refs were not updated
2026-05-30T01:48:36.5313762Z evaluating expression ''
2026-05-30T01:48:36.5314804Z expression '' evaluated to 'true'
2026-05-30T01:48:36.5315029Z ⭐ Run Main  Checkout
2026-05-30T01:48:36.5315334Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-30T01:48:36.5315627Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-30T01:48:36.5315836Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-30T01:48:36.5316040Z Writing entry to tarball workflow/envs.txt len:0
2026-05-30T01:48:36.5316222Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-30T01:48:36.5316445Z Extracting content to '/var/run/act'
2026-05-30T01:48:36.5453220Z expression '${{ github.token }}' rewritten to 'format('{0}', github.token)'
2026-05-30T01:48:36.5453667Z evaluating expression 'format('{0}', github.token)'
2026-05-30T01:48:36.5454243Z expression 'format('{0}', github.token)' evaluated to '%!t(string=***)'
2026-05-30T01:48:36.5455160Z expression '${{ github.repository }}' rewritten to 'format('{0}', github.repository)'
2026-05-30T01:48:36.5455378Z evaluating expression 'format('{0}', github.repository)'
2026-05-30T01:48:36.5455715Z expression 'format('{0}', github.repository)' evaluated to '%!t(string=np-dms/lcbp3)'
2026-05-30T01:48:36.5456355Z type=remote-action actionDir=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab actionPath= workdir=/workspace/np-dms/lcbp3 actionCacheDir=/root/.cache/act actionName=c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab containerActionDir=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-30T01:48:36.5456694Z /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab
2026-05-30T01:48:36.5457066Z   🐳  docker cp src=/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ dst=/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-30T01:48:36.5459584Z Writing tarball /tmp/act1209180511 from /root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-30T01:48:36.5459843Z Stripping prefix:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/ src:/root/.cache/act/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/
2026-05-30T01:48:36.7417091Z Extracting content from '/tmp/act1209180511' to '/var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/'
2026-05-30T01:48:37.0561179Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-30T01:48:37.0561899Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-30T01:48:37.0562165Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-30T01:48:37.0562843Z Working directory '/workspace/np-dms/lcbp3'
2026-05-30T01:48:37.3607511Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-30T01:48:37.3607821Z ::add-matcher::/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/problem-matcher.json
2026-05-30T01:48:37.3608170Z Syncing repository: np-dms/lcbp3
2026-05-30T01:48:37.3608576Z ::group::Getting Git version info
2026-05-30T01:48:37.3608783Z Working directory is '/workspace/np-dms/lcbp3'
2026-05-30T01:48:37.3680049Z [command]/usr/bin/git version
2026-05-30T01:48:37.3764321Z git version 2.30.2
2026-05-30T01:48:37.3813220Z ::endgroup::
2026-05-30T01:48:37.3843023Z Temporarily overriding HOME='/tmp/d4335ea0-e379-4e1e-a2f7-f702e3a6adb8' before making global git config changes
2026-05-30T01:48:37.3843979Z Adding repository directory to the temporary git global config as a safe directory
2026-05-30T01:48:37.3854899Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-30T01:48:37.3932006Z Deleting the contents of '/workspace/np-dms/lcbp3'
2026-05-30T01:48:37.3940593Z ::group::Initializing the repository
2026-05-30T01:48:37.3949310Z [command]/usr/bin/git init /workspace/np-dms/lcbp3
2026-05-30T01:48:37.4016245Z hint: Using 'master' as the name for the initial branch. This default branch name
2026-05-30T01:48:37.4016932Z hint: is subject to change. To configure the initial branch name to use in all
2026-05-30T01:48:37.4017155Z hint: of your new repositories, which will suppress this warning, call:
2026-05-30T01:48:37.4017431Z hint: 
2026-05-30T01:48:37.4017736Z hint: 	git config --global init.defaultBranch <name>
2026-05-30T01:48:37.4017929Z hint: 
2026-05-30T01:48:37.4018093Z hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
2026-05-30T01:48:37.4018278Z hint: 'development'. The just-created branch can be renamed via this command:
2026-05-30T01:48:37.4018465Z hint: 
2026-05-30T01:48:37.4018624Z hint: 	git branch -m <name>
2026-05-30T01:48:37.4028441Z Initialized empty Git repository in /workspace/np-dms/lcbp3/.git/
2026-05-30T01:48:37.4048229Z [command]/usr/bin/git remote add origin https://git.np-dms.work/np-dms/lcbp3
2026-05-30T01:48:37.4112940Z ::endgroup::
2026-05-30T01:48:37.4113365Z ::group::Disabling automatic garbage collection
2026-05-30T01:48:37.4121762Z [command]/usr/bin/git config --local gc.auto 0
2026-05-30T01:48:37.4183739Z ::endgroup::
2026-05-30T01:48:37.4184148Z ::group::Setting up auth
2026-05-30T01:48:37.4196863Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-30T01:48:37.4258936Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-30T01:48:37.4759157Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-30T01:48:37.4824035Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-30T01:48:37.5322383Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-30T01:48:37.5385397Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-30T01:48:37.5877318Z [command]/usr/bin/git config --local http.https://git.np-dms.work/.extraheader AUTHORIZATION: basic ***
2026-05-30T01:48:37.5960844Z ::endgroup::
2026-05-30T01:48:37.5961516Z ::group::Fetching the repository
2026-05-30T01:48:37.5972893Z [command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --no-recurse-submodules --depth=1 origin +63ded103418dade9eccc770476e8a4709c9fdd56:refs/remotes/origin/main
2026-05-30T01:48:39.4261139Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-30T01:48:39.4261840Z  * [new ref]         63ded103418dade9eccc770476e8a4709c9fdd56 -> origin/main
2026-05-30T01:48:39.4325048Z ::endgroup::
2026-05-30T01:48:39.4325624Z ::group::Determining the checkout info
2026-05-30T01:48:39.4328148Z ::endgroup::
2026-05-30T01:48:39.4336783Z [command]/usr/bin/git sparse-checkout disable
2026-05-30T01:48:39.4409502Z [command]/usr/bin/git config --local --unset-all extensions.worktreeConfig
2026-05-30T01:48:39.4467465Z ::group::Checking out the ref
2026-05-30T01:48:39.4476361Z [command]/usr/bin/git checkout --progress --force -B main refs/remotes/origin/main
2026-05-30T01:48:39.8316232Z Switched to a new branch 'main'
2026-05-30T01:48:39.8316990Z Branch 'main' set up to track remote branch 'main' from 'origin'.
2026-05-30T01:48:39.8356508Z ::endgroup::
2026-05-30T01:48:39.8416646Z [command]/usr/bin/git log -1 --format=%H
2026-05-30T01:48:39.8470362Z 63ded103418dade9eccc770476e8a4709c9fdd56
2026-05-30T01:48:39.8501619Z ::remove-matcher owner=checkout-git::
2026-05-30T01:48:41.2138510Z From https://git.np-dms.work/np-dms/lcbp3
2026-05-30T01:48:41.2139633Z  * branch              main       -> FETCH_HEAD
2026-05-30T01:48:41.2160167Z    6799cb17..63ded103  main       -> origin/main
2026-05-30T01:48:41.3280585Z HEAD is now at 63ded103 690530:0820 ADR-030-230 context aware #11
2026-05-30T01:48:41.3321500Z =========================================
2026-05-30T01:48:41.3321927Z LCBP3-DMS Deployment v2.0
2026-05-30T01:48:41.3322133Z =========================================
2026-05-30T01:48:41.4075213Z [1/3] Building Docker images (parallel)...
2026-05-30T01:48:43.0408786Z #0 building with "default" instance using docker driver
2026-05-30T01:48:43.0409553Z 
2026-05-30T01:48:43.0409744Z #1 [internal] load build definition from Dockerfile
2026-05-30T01:48:43.0409939Z #0 building with "default" instance using docker driver
2026-05-30T01:48:43.0410125Z 
2026-05-30T01:48:43.0410341Z #1 [internal] load build definition from Dockerfile
2026-05-30T01:48:43.2069231Z #1 transferring dockerfile:
2026-05-30T01:48:43.3516360Z #1 transferring dockerfile:
2026-05-30T01:48:43.3616398Z #1 transferring dockerfile: 5.15kB done
2026-05-30T01:48:43.5287164Z #1 transferring dockerfile: 3.41kB 0.0s done
2026-05-30T01:48:45.5921702Z #1 DONE 2.7s
2026-05-30T01:48:45.7847713Z 
2026-05-30T01:48:45.7848440Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-30T01:48:46.0139225Z #1 DONE 3.1s
2026-05-30T01:48:46.2428612Z 
2026-05-30T01:48:46.2429524Z #2 [internal] load metadata for docker.io/library/node:24-alpine
2026-05-30T01:48:48.1468423Z #2 DONE 2.4s
2026-05-30T01:48:48.1470369Z #2 DONE 2.1s
2026-05-30T01:48:48.2590368Z 
2026-05-30T01:48:48.2591297Z #3 [internal] load .dockerignore
2026-05-30T01:48:48.2591733Z #3 transferring context:
2026-05-30T01:48:48.3928247Z 
2026-05-30T01:48:48.3929118Z #3 [internal] load .dockerignore
2026-05-30T01:48:48.3929736Z #3 transferring context: 1.13kB 0.0s done
2026-05-30T01:48:48.4150372Z #3 transferring context: 1.13kB done
2026-05-30T01:48:48.5199119Z #3 DONE 0.4s
2026-05-30T01:48:48.7304580Z 
2026-05-30T01:48:48.7305289Z #4 [internal] load build context
2026-05-30T01:48:48.7305555Z #4 DONE 0.0s
2026-05-30T01:48:48.7305723Z 
2026-05-30T01:48:48.7305900Z #5 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-30T01:48:48.7306216Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-30T01:48:48.7561103Z #3 DONE 0.6s
2026-05-30T01:48:48.9362405Z 
2026-05-30T01:48:48.9363117Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.4s done
2026-05-30T01:48:48.9363447Z #4 [internal] load build context
2026-05-30T01:48:48.9364046Z #4 DONE 0.0s
2026-05-30T01:48:48.9364269Z 
2026-05-30T01:48:48.9364448Z #5 [deps 1/6] FROM docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
2026-05-30T01:48:48.9364763Z #5 resolve docker.io/library/node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 0.4s done
2026-05-30T01:48:49.0378659Z #5 DONE 0.4s
2026-05-30T01:48:49.0379531Z 
2026-05-30T01:48:49.0379791Z #4 [internal] load build context
2026-05-30T01:48:49.1114311Z #5 DONE 0.4s
2026-05-30T01:48:49.1114985Z 
2026-05-30T01:48:49.1115187Z #4 [internal] load build context
2026-05-30T01:48:49.4236788Z #4 transferring context: 169.06kB 0.2s done
2026-05-30T01:48:49.4542865Z #4 transferring context: 130.***kB 0.2s done
2026-05-30T01:48:49.5546309Z #4 DONE 0.6s
2026-05-30T01:48:49.7976359Z #4 DONE 0.8s
2026-05-30T01:48:49.8620107Z 
2026-05-30T01:48:49.8620833Z #6 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-30T01:48:49.8621104Z #6 CACHED
2026-05-30T01:48:49.8621476Z 
2026-05-30T01:48:49.8621703Z #7 [deps 5/6] COPY backend/package.json ./backend/
2026-05-30T01:48:49.8621901Z #7 CACHED
2026-05-30T01:48:49.8622119Z 
2026-05-30T01:48:49.8622287Z #8 [deps 6/6] RUN pnpm install --frozen-lockfile --filter backend...
2026-05-30T01:48:49.8622486Z #8 CACHED
2026-05-30T01:48:49.8622650Z 
2026-05-30T01:48:49.8622897Z #9 [build  5/10] COPY --from=deps /app/node_modules ./node_modules
2026-05-30T01:48:49.8623095Z #9 CACHED
2026-05-30T01:48:49.8623254Z 
2026-05-30T01:48:49.8623494Z #10 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-30T01:48:49.8623737Z #10 CACHED
2026-05-30T01:48:49.8623925Z 
2026-05-30T01:48:49.8624079Z #11 [deps 3/6] WORKDIR /app
2026-05-30T01:48:49.8624334Z #11 CACHED
2026-05-30T01:48:49.8624500Z 
2026-05-30T01:48:49.8624703Z #12 [build  6/10] COPY --from=deps /app/backend/node_modules ./backend/node_modules
2026-05-30T01:48:49.9518137Z 
2026-05-30T01:48:49.9518997Z #6 [production 8/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/package.json ./
2026-05-30T01:48:49.9519349Z #6 CACHED
2026-05-30T01:48:49.9519606Z 
2026-05-30T01:48:49.9519849Z #7 [build  7/14] COPY --from=deps /w/frontend/node_modules ./node_modules
2026-05-30T01:48:49.9520095Z #7 CACHED
2026-05-30T01:48:49.9520382Z 
2026-05-30T01:48:49.9520605Z #8 [production 2/9] WORKDIR /app
2026-05-30T01:48:49.9520838Z #8 CACHED
2026-05-30T01:48:49.9521027Z 
2026-05-30T01:48:49.9521195Z #9 [production 6/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/.next ./.next
2026-05-30T01:48:49.9521468Z #9 CACHED
2026-05-30T01:48:49.9521640Z 
2026-05-30T01:48:49.9521791Z #10 [build  4/14] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-30T01:48:49.9521984Z #10 CACHED
2026-05-30T01:48:49.9522200Z 
2026-05-30T01:48:49.9522380Z #11 [deps 3/6] WORKDIR /w
2026-05-30T01:48:49.9522593Z #11 CACHED
2026-05-30T01:48:49.9522786Z 
2026-05-30T01:48:49.9523059Z #12 [production 3/9] RUN addgroup -g 1001 -S nextjs &&     adduser -S nextjs -u 1001
2026-05-30T01:48:49.9523254Z #12 CACHED
2026-05-30T01:48:49.9523413Z 
2026-05-30T01:48:49.9523616Z #13 [build 10/14] RUN set -e;     MONACO_VS=$(find /w/frontend/node_modules /w/node_modules       -path "*/monaco-editor/min/vs" -type d 2>/dev/null | head -1);     if [ -z "$MONACO_VS" ]; then       echo "ERROR: monaco-editor/min/vs not found in node_modules" && exit 1;     fi;     echo "Found Monaco at: $MONACO_VS";     mkdir -p /w/frontend/public;     cp -rL "$MONACO_VS" /w/frontend/public/monaco-vs;     echo "Monaco assets copied successfully"
2026-05-30T01:48:49.9524017Z #13 CACHED
2026-05-30T01:48:49.9524177Z 
2026-05-30T01:48:49.9524346Z #14 [production 5/9] COPY --from=build --chown=nextjs:nextjs /deploy/node_modules ./node_modules
2026-05-30T01:48:49.9524631Z #14 CACHED
2026-05-30T01:48:49.9524849Z 
2026-05-30T01:48:49.9525057Z #15 [build 14/14] RUN pnpm --filter lcbp3-frontend deploy /deploy --prod --legacy
2026-05-30T01:48:49.9525260Z #15 CACHED
2026-05-30T01:48:49.9525415Z 
2026-05-30T01:48:49.9525611Z #16 [build  5/14] COPY --from=deps /w/node_modules ./node_modules
2026-05-30T01:48:49.9525840Z #16 CACHED
2026-05-30T01:48:49.9526049Z 
2026-05-30T01:48:49.9526278Z #17 [production 4/9] RUN apk add --no-cache curl
2026-05-30T01:48:49.9526489Z #17 CACHED
2026-05-30T01:48:49.9526681Z 
2026-05-30T01:48:49.9526872Z #18 [build  2/14] RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
2026-05-30T01:48:49.9527129Z #18 CACHED
2026-05-30T01:48:49.9527311Z 
2026-05-30T01:48:49.9527466Z #19 [build  3/14] WORKDIR /w
2026-05-30T01:48:49.9527632Z #19 CACHED
2026-05-30T01:48:49.9527785Z 
2026-05-30T01:48:49.9527995Z #20 [deps 4/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
2026-05-30T01:48:49.9528188Z #20 CACHED
2026-05-30T01:48:49.9528346Z 
2026-05-30T01:48:49.9528517Z #21 [build  6/14] WORKDIR /w/frontend
2026-05-30T01:48:49.9528734Z #21 CACHED
2026-05-30T01:48:49.9529047Z 
2026-05-30T01:48:49.9529208Z #*** [production 7/9] COPY --from=build --chown=nextjs:nextjs /w/frontend/public ./public
2026-05-30T01:48:49.9529413Z #*** CACHED
2026-05-30T01:48:49.9529586Z 
2026-05-30T01:48:49.9529746Z #23 [build 12/14] RUN ls -la /w/frontend/.next/ || (echo "ERROR: Build not found!" && exit 1)
2026-05-30T01:48:49.9529957Z #23 CACHED
2026-05-30T01:48:49.9530119Z 
2026-05-30T01:48:49.9530271Z #24 [build 13/14] WORKDIR /w
2026-05-30T01:48:49.9530440Z #24 CACHED
2026-05-30T01:48:49.9530600Z 
2026-05-30T01:48:49.9530780Z #25 [deps 5/6] COPY frontend/package.json ./frontend/
2026-05-30T01:48:49.9530968Z #25 CACHED
2026-05-30T01:48:49.9531138Z 
2026-05-30T01:48:49.9531297Z #26 [deps 6/6] RUN pnpm install --frozen-lockfile --ignore-scripts --filter lcbp3-frontend...
2026-05-30T01:48:49.9531507Z #26 CACHED
2026-05-30T01:48:49.9531664Z 
2026-05-30T01:48:49.9531823Z #27 [deps 2/6] RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
2026-05-30T01:48:49.9532017Z #27 CACHED
2026-05-30T01:48:49.9532199Z 
2026-05-30T01:48:49.9532369Z #28 [build  9/14] RUN ls -la /w/frontend/public/ || (echo "WARNING: public directory not found, creating empty one" && mkdir -p /w/frontend/public)
2026-05-30T01:48:49.9532607Z #28 CACHED
2026-05-30T01:48:49.9532761Z 
2026-05-30T01:48:49.9532914Z #29 [build 11/14] RUN mkdir /n && ln -s /n .next &&     pnpm run build &&     rm .next && mv /n .next
2026-05-30T01:48:49.9533116Z #29 CACHED
2026-05-30T01:48:49.9533270Z 
2026-05-30T01:48:49.9533423Z #30 [build  8/14] COPY frontend/ ./
2026-05-30T01:48:49.9533607Z #30 CACHED
2026-05-30T01:48:49.9533777Z 
2026-05-30T01:48:49.9533955Z #31 [production 9/9] RUN ls -la ./node_modules/next/dist/bin/next && ls -la ./.next/ && ls -la ./public/ || (echo "ERROR: Required files not found!" && exit 1)
2026-05-30T01:48:50.0216780Z #12 CACHED
2026-05-30T01:48:50.0217490Z 
2026-05-30T01:48:50.0217691Z #13 [build  7/10] COPY backend/ ./backend/
2026-05-30T01:48:50.1043386Z #31 CACHED
2026-05-30T01:48:50.1044122Z 
2026-05-30T01:48:50.1044320Z #32 exporting to image
2026-05-30T01:48:50.1044502Z #32 exporting layers done
2026-05-30T01:48:50.1044696Z #32 writing image sha256:ed903c5b9a28bc8343555098400d0b1032e42b1c5f1dbac348bbb6382d68834a 0.1s done
2026-05-30T01:48:50.1045022Z #32 naming to docker.io/library/lcbp3-frontend:latest
2026-05-30T01:48:50.2451232Z #32 naming to docker.io/library/lcbp3-frontend:latest 0.1s done
2026-05-30T01:48:50.4556000Z #32 DONE 0.4s
2026-05-30T01:48:55.3705790Z #13 DONE 5.5s
2026-05-30T01:48:55.4730879Z 
2026-05-30T01:48:55.4732050Z #14 [build  8/10] RUN cd backend &&     NODE_OPTIONS="--max-old-space-size=4096"     pnpm run build
2026-05-30T01:48:59.7870360Z #14 4.314 
2026-05-30T01:48:59.7871111Z #14 4.314 > backend@1.8.1 build /app/backend
2026-05-30T01:48:59.7871829Z #14 4.314 > nest build
2026-05-30T01:48:59.7872127Z #14 4.314 
2026-05-30T01:49:40.0402640Z #14 DONE 44.6s
2026-05-30T01:49:40.2725240Z 
2026-05-30T01:49:40.2726309Z #15 [build  9/10] RUN PNPM_IGNORE_SCRIPTS=none     pnpm --filter backend deploy --prod --shamefully-hoist --legacy --no-optional /app/backend-prod
2026-05-30T01:49:43.9223350Z #15 3.801  WARN  Shared workspace lockfile detected but configuration forces legacy deploy implementation.
2026-05-30T01:49:44.0852940Z #15 3.964 Packages are copied from the content-addressable store to the virtual store.
2026-05-30T01:49:44.0853764Z #15 3.964   Content-addressable store is at: /root/.local/share/pnpm/store/v10
2026-05-30T01:49:44.0854256Z #15 3.964   Virtual store is at:             backend-prod/node_modules/.pnpm
2026-05-30T01:49:44.5385219Z #15 4.416 Progress: resolved 0, reused 0, downloaded 1, added 0
2026-05-30T01:49:45.5399217Z #15 5.418 Progress: resolved 48, reused 0, downloaded 48, added 0
2026-05-30T01:49:46.5396146Z #15 6.418 Progress: resolved 83, reused 0, downloaded 83, added 0
2026-05-30T01:49:47.5398356Z #15 7.418 Progress: resolved 90, reused 0, downloaded 90, added 0
2026-05-30T01:49:49.0277713Z #15 8.906 Progress: resolved 90, reused 0, downloaded 91, added 0
2026-05-30T01:49:50.0285630Z #15 9.907 Progress: resolved 134, reused 0, downloaded 134, added 0
2026-05-30T01:49:51.0289461Z #15 10.91 Progress: resolved 140, reused 0, downloaded 140, added 0
2026-05-30T01:49:52.0294805Z #15 11.91 Progress: resolved 179, reused 0, downloaded 179, added 0
2026-05-30T01:49:53.0296819Z #15 12.91 Progress: resolved 207, reused 0, downloaded 207, added 0
2026-05-30T01:49:54.0318220Z #15 13.91 Progress: resolved ***9, reused 0, downloaded ***9, added 0
2026-05-30T01:49:55.0507883Z #15 14.93 Progress: resolved 326, reused 0, downloaded 326, added 0
2026-05-30T01:49:56.0515606Z #15 15.93 Progress: resolved 418, reused 0, downloaded 418, added 0
2026-05-30T01:49:57.0524522Z #15 16.93 Progress: resolved 456, reused 0, downloaded 456, added 0
2026-05-30T01:49:58.0519486Z #15 17.93 Progress: resolved 569, reused 0, downloaded 569, added 0
2026-05-30T01:49:59.0516836Z #15 18.93 Progress: resolved 680, reused 0, downloaded 679, added 0
2026-05-30T01:50:00.0524845Z #15 19.93 Progress: resolved 766, reused 0, downloaded 766, added 0
2026-05-30T01:50:01.0525456Z #15 20.93 Progress: resolved 846, reused 0, downloaded 839, added 0
2026-05-30T01:50:01.6539349Z #15 21.53  WARN  Tarball download average speed 21 KiB/s (size 28 KiB) is below 50 KiB/s: https://registry.npmjs.org/@webassemblyjs/ast/-/ast-1.14.1.tgz (GET)
2026-05-30T01:50:02.0522864Z #15 21.93 Progress: resolved 881, reused 0, downloaded 869, added 0
2026-05-30T01:50:03.0519538Z #15 ***.93 Progress: resolved 908, reused 0, downloaded 894, added 0
2026-05-30T01:50:04.0555615Z #15 23.93 Progress: resolved 952, reused 0, downloaded 929, added 0
2026-05-30T01:50:05.0557990Z #15 24.93 Progress: resolved 1035, reused 0, downloaded 1006, added 0
2026-05-30T01:50:06.0550869Z #15 25.93 Progress: resolved 1042, reused 0, downloaded 1018, added 0
2026-05-30T01:50:15.4776628Z #15 35.36 Progress: resolved 1042, reused 0, downloaded 1019, added 0
2026-05-30T01:50:16.4778805Z #15 36.36 Progress: resolved 1076, reused 0, downloaded 1050, added 0
2026-05-30T01:50:17.4780488Z #15 37.36 Progress: resolved 1088, reused 0, downloaded 1062, added 0
2026-05-30T01:50:18.4790514Z #15 38.36 Progress: resolved 1150, reused 0, downloaded 1124, added 0
2026-05-30T01:50:19.4801075Z #15 39.36 Progress: resolved 1236, reused 0, downloaded 1212, added 0
2026-05-30T01:50:20.4808789Z #15 40.36 Progress: resolved 1249, reused 0, downloaded 1***5, added 0
2026-05-30T01:50:21.4817554Z #15 41.36 Progress: resolved 1250, reused 0, downloaded 1***6, added 0
2026-05-30T01:50:22.5483647Z #15 42.43  WARN  3 deprecated subdependencies found: glob@7.2.3, inflight@1.0.6, whatwg-encoding@3.1.1
2026-05-30T01:50:22.7698933Z #15 42.48 Progress: resolved 1252, reused 0, downloaded 1***8, added 0
2026-05-30T01:50:22.7699785Z #15 42.50 .                                        | +458 ++++++++++++++++++++++++++++++++
2026-05-30T01:50:23.6038000Z #15 43.48 Progress: resolved 1252, reused 0, downloaded 1***8, added 457
2026-05-30T01:50:23.7052645Z #15 43.58 Progress: resolved 1252, reused 0, downloaded 1***8, added 458, done
2026-05-30T01:50:23.8533409Z #15 43.73 .../node_modules/@scarf/scarf postinstall$ node ./report.js
2026-05-30T01:50:23.9710724Z #15 43.83 .../node_modules/@nestjs/core postinstall$ opencollective || exit 0
2026-05-30T01:50:23.9711531Z #15 43.85 .../bcrypt@6.0.0/node_modules/bcrypt install$ node-gyp-build
2026-05-30T01:50:24.1270694Z #15 44.00 .../bcrypt@6.0.0/node_modules/bcrypt install: Done
2026-05-30T01:50:24.6325586Z #15 44.51 .../node_modules/@nestjs/core postinstall:                            Thanks for installing nest 
2026-05-30T01:50:24.8816422Z #15 44.51 .../node_modules/@nestjs/core postinstall:                  Please consider donating to our open collective
2026-05-30T01:50:24.8817195Z #15 44.51 .../node_modules/@nestjs/core postinstall:                         to help us maintain this package.
2026-05-30T01:50:24.8817420Z #15 44.51 .../node_modules/@nestjs/core postinstall:                                          
2026-05-30T01:50:24.8817632Z #15 44.51 .../node_modules/@nestjs/core postinstall:                             Number of contributors: 0
2026-05-30T01:50:24.8817933Z #15 44.51 .../node_modules/@nestjs/core postinstall:                              Number of backers: 1201
2026-05-30T01:50:24.8818204Z #15 44.52 .../node_modules/@nestjs/core postinstall:                              Annual budget: $136,529
2026-05-30T01:50:24.8818412Z #15 44.52 .../node_modules/@nestjs/core postinstall:                              Current balance: $3,540
2026-05-30T01:50:24.8818615Z #15 44.53 .../node_modules/@nestjs/core postinstall:                                          
2026-05-30T01:50:24.8818923Z #15 44.53 .../node_modules/@nestjs/core postinstall:              Become a partner: https://opencollective.com/nest/donate
2026-05-30T01:50:24.8819197Z #15 44.53 .../node_modules/@nestjs/core postinstall:                                          
2026-05-30T01:50:24.8819406Z #15 44.61 .../node_modules/@nestjs/core postinstall: Done
2026-05-30T01:50:27.1075497Z #15 46.99 .../node_modules/@scarf/scarf postinstall: Done
2026-05-30T01:50:27.2135984Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin.js'
2026-05-30T01:50:27.3650503Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-cwd. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-cwd.js'
2026-05-30T01:50:27.3651393Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-esm. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-esm.js'
2026-05-30T01:50:27.3651806Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-script. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-script.js'
2026-05-30T01:50:27.3652257Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-node-transpile-only. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-transpile.js'
2026-05-30T01:50:27.3652643Z #15 47.09  WARN  Failed to create bin at /app/backend-prod/node_modules/.pnpm/typeorm@0.3.27_ioredis@5.8.2_mysql2@3.15.3_redis@4.7.1_reflect-metadata@0.2.2_ts-node@1_a2dc5b77c713fab455f1a297d51ed595/node_modules/typeorm/node_modules/.bin/ts-script. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/ts-node@10.9.2_@types+node@25.5.0_typescript@5.9.3/node_modules/ts-node/dist/bin-script-deprecated.js'
2026-05-30T01:50:27.4696030Z #15 47.35  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/acorn. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/acorn@8.16.0/node_modules/acorn/bin/acorn'
2026-05-30T01:50:27.6201910Z #15 47.35  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/browserslist. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/browserslist@4.28.1/node_modules/browserslist/cli.js'
2026-05-30T01:50:27.6202786Z #15 47.35  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/webpack. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/webpack@5.105.4/node_modules/webpack/bin/webpack.js'
2026-05-30T01:50:27.6203073Z #15 47.35  WARN  Failed to create bin at /app/backend/backend-prod/node_modules/.bin/jiti. ENOENT: no such file or directory, open '/app/backend-prod/node_modules/.pnpm/jiti@2.6.1/node_modules/jiti/lib/jiti-cli.mjs'
2026-05-30T01:50:27.9082268Z #15 47.79 . prepare$ husky
2026-05-30T01:50:28.0398470Z #15 47.92 . prepare: .git can't be found
2026-05-30T01:50:28.1907972Z #15 47.92 . prepare: Done
2026-05-30T01:50:35.8488591Z #15 DONE 55.7s
2026-05-30T01:50:35.9543895Z 
2026-05-30T01:50:35.9544646Z #16 [build 10/10] RUN find /app/backend-prod/node_modules -name "*.md" -delete     && find /app/backend-prod/node_modules -name "*.txt" -delete     && find /app/backend-prod/node_modules -name "LICENSE*" -delete     && find /app/backend-prod/node_modules -name "README*" -delete     && find /app/backend-prod/node_modules -name "CHANGELOG*" -delete
2026-05-30T01:50:48.4866232Z #16 DONE 12.5s
2026-05-30T01:50:49.5646167Z 
2026-05-30T01:50:49.5646915Z #17 [production 3/8] WORKDIR /app
2026-05-30T01:50:49.5647156Z #17 CACHED
2026-05-30T01:50:49.5647327Z 
2026-05-30T01:50:49.5647514Z #18 [production 2/8] RUN apk add --no-cache curl
2026-05-30T01:50:49.5647723Z #18 CACHED
2026-05-30T01:50:49.5647913Z 
2026-05-30T01:50:49.5648095Z #19 [production 4/8] RUN addgroup -g 1001 -S nestjs &&     adduser -S nestjs -u 1001
2026-05-30T01:50:49.7149018Z #19 CACHED
2026-05-30T01:50:49.7149739Z 
2026-05-30T01:50:49.7149942Z #20 [production 5/8] COPY --from=build --chown=nestjs:nestjs /app/backend/dist ./dist
2026-05-30T01:50:53.8812241Z #20 DONE 4.3s
2026-05-30T01:50:54.1234546Z 
2026-05-30T01:50:54.1235380Z #21 [production 6/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/package.json ./
2026-05-30T01:50:56.0587592Z #21 DONE 2.1s
2026-05-30T01:51:06.4817699Z 
2026-05-30T01:51:06.4818400Z #*** [production 7/8] COPY --from=build --chown=nestjs:nestjs /app/backend-prod/node_modules ./node_modules
2026-05-30T01:51:33.8668584Z #*** DONE 27.4s
2026-05-30T01:51:33.9975710Z 
2026-05-30T01:51:33.9976575Z #23 [production 8/8] RUN mkdir -p /app/uploads/temp /app/uploads/permanent &&     chown -R nestjs:nestjs /app/uploads
2026-05-30T01:51:37.8062180Z #23 DONE 3.8s
2026-05-30T01:51:38.0208046Z 
2026-05-30T01:51:38.0208966Z #24 exporting to image
2026-05-30T01:51:38.0209282Z #24 exporting layers
2026-05-30T01:51:46.7175864Z #24 exporting layers 8.8s done
2026-05-30T01:51:46.7176656Z #24 writing image sha256:a70c5c2f706532e56bce4719983e88b1ad7e76556fa4c1f4bcff4f03bd21b64a
2026-05-30T01:51:46.9075852Z #24 writing image sha256:a70c5c2f706532e56bce4719983e88b1ad7e76556fa4c1f4bcff4f03bd21b64a 0.0s done
2026-05-30T01:51:46.9076605Z #24 naming to docker.io/library/lcbp3-backend:latest
2026-05-30T01:51:47.1015386Z #24 naming to docker.io/library/lcbp3-backend:latest 0.3s done
2026-05-30T01:51:47.6085118Z #24 DONE 9.7s
2026-05-30T01:51:49.3688281Z ✓ Images built
2026-05-30T01:51:49.3689073Z [2/3] Starting application stack...
2026-05-30T01:51:50.0635895Z  Container clamav  Recreate
2026-05-30T01:51:56.4160948Z  Container clamav  Recreated
2026-05-30T01:51:56.4161703Z  Container backend  Recreate
2026-05-30T01:51:59.0088956Z  Container backend  Recreated
2026-05-30T01:51:59.0090022Z  Container frontend  Recreate
2026-05-30T01:52:01.5143924Z  Container frontend  Recreated
2026-05-30T01:52:01.5170392Z  Container clamav  Starting
2026-05-30T01:52:03.1810018Z  Container clamav  Started
2026-05-30T01:52:03.1810738Z  Container clamav  Waiting
2026-05-30T01:52:29.1840636Z  Container clamav  Healthy
2026-05-30T01:52:29.1841406Z  Container backend  Starting
2026-05-30T01:52:31.2488562Z  Container backend  Started
2026-05-30T01:52:31.2489960Z  Container backend  Waiting
2026-05-30T01:52:37.7495960Z  Container backend  Healthy
2026-05-30T01:52:37.7496699Z  Container frontend  Starting
2026-05-30T01:52:41.5014307Z  Container frontend  Started
2026-05-30T01:52:41.5092348Z ✓ Stack started
2026-05-30T01:52:41.5093176Z [3/3] Waiting for backend to be healthy...
2026-05-30T01:52:41.8959055Z ✓ Backend is healthy
2026-05-30T01:52:41.8963284Z =========================================
2026-05-30T01:52:41.8963688Z ✓ Deployment completed successfully!
2026-05-30T01:52:41.8964077Z =========================================
2026-05-30T01:52:41.9421276Z evaluating expression 'always()'
2026-05-30T01:52:41.9422043Z expression 'always()' evaluated to 'true'
2026-05-30T01:52:41.9422280Z ⭐ Run Post  Checkout
2026-05-30T01:52:41.9422601Z Writing entry to tarball workflow/outputcmd.txt len:0
2026-05-30T01:52:41.9422875Z Writing entry to tarball workflow/statecmd.txt len:0
2026-05-30T01:52:41.9423071Z Writing entry to tarball workflow/pathcmd.txt len:0
2026-05-30T01:52:41.9423309Z Writing entry to tarball workflow/envs.txt len:0
2026-05-30T01:52:41.9423494Z Writing entry to tarball workflow/SUMMARY.md len:0
2026-05-30T01:52:41.9423716Z Extracting content to '/var/run/act'
2026-05-30T01:52:41.9460592Z run post step for ' Checkout'
2026-05-30T01:52:41.9461828Z executing remote job container: [node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]
2026-05-30T01:52:41.9462135Z   🐳  docker exec cmd=[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js] user= workdir=
2026-05-30T01:52:41.9462372Z Exec command '[node /var/run/act/actions/c3fe249fe73091a17d6638fe1341e7bd0bcc3466ce52323c0688e83e2463a4ab/dist/index.js]'
2026-05-30T01:52:41.9463060Z Working directory '/workspace/np-dms/lcbp3'
2026-05-30T01:52:42.2431837Z [command]/usr/bin/git version
2026-05-30T01:52:42.2504949Z git version 2.30.2
2026-05-30T01:52:42.2558093Z ***
2026-05-30T01:52:42.2587452Z Temporarily overriding HOME='/tmp/dbcf9ac9-16a1-4820-ad06-c28e3a5ec090' before making global git config changes
2026-05-30T01:52:42.2589042Z Adding repository directory to the temporary git global config as a safe directory
2026-05-30T01:52:42.2601496Z [command]/usr/bin/git config --global --add safe.directory /workspace/np-dms/lcbp3
2026-05-30T01:52:42.2677722Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-05-30T01:52:42.2750217Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-05-30T01:52:42.3254419Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/git\.np\-dms\.work\/\.extraheader
2026-05-30T01:52:42.3302649Z http.https://git.np-dms.work/.extraheader
2026-05-30T01:52:42.3324626Z [command]/usr/bin/git config --local --unset-all http.https://git.np-dms.work/.extraheader
2026-05-30T01:52:42.3391224Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/git\.np\-dms\.work\/\.extraheader' && git config --local --unset-all 'http.https://git.np-dms.work/.extraheader' || :"
2026-05-30T01:52:42.3895078Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-05-30T01:52:42.3962178Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-05-30T01:52:42.4610732Z   ✅  Success - Post  Checkout
2026-05-30T01:52:42.4728636Z Cleaning up container for job deploy
2026-05-30T01:52:43.6796518Z Removed container: b362ab9832bf7d7ef35fb50af8308f9512388815d7b2e2f2d4189961bd162f73
2026-05-30T01:52:43.6812043Z   🐳  docker volume rm GITEA-ACTIONS-TASK-566_WORKFLOW-CI-CD-Pipeline_JOB-deploy
2026-05-30T01:52:43.9920899Z   🐳  docker volume rm GITEA-ACTIONS-TASK-566_WORKFLOW-CI-CD-Pipeline_JOB-deploy-env
2026-05-30T01:52:44.2242277Z 🏁  Job succeeded
