> lcbp3-frontend@1.8.1 test /workspace/np-dms/lcbp3/frontend
> vitest run
 RUN [***m v4.1.0 /workspace/np-dms/lcbp3/frontend
 ✓ lib/services/__tests__/master-data.service.test.ts ([***m26 tests[***m)[***m 58ms[***m
 ❯ hooks/__tests__/use-correspondence.test.ts ([***m12 tests[***m | [***m4 failed)[***m 13***ms[***m
       ✓ should generate correct cache keys 9ms[***m
       ✓ should fetch correspondences successfully 101ms[***m
       ✓ should handle error state 62ms[***m
       × should fetch single correspondence by id 1050ms[***m
       ✓ should not fetch when id is falsy 7ms[***m
       ✓ should create correspondence and show success toast 11ms[***m
       ✓ should show error toast on failure 7ms[***m
       × should update correspondence and invalidate cache 10ms[***m
       ✓ should delete correspondence and show success toast 6ms[***m
       × should submit correspondence for workflow 9ms[***m
       × should process workflow action 20ms[***m
       ✓ should handle workflow action error ***ms[***m
 ❯ hooks/__tests__/use-drawing.test.ts ([***m10 tests[***m | [***m4 failed)[***m 2331ms[***m
       ✓ should generate correct cache keys 6ms[***m
       × should fetch CONTRACT drawings successfully 121ms[***m
       × should fetch SHOP drawings successfully 69ms[***m
       ✓ should handle error state 58ms[***m
       × should fetch single CONTRACT drawing by id 1028ms[***m
       × should fetch single SHOP drawing by id 1013ms[***m
       ✓ should not fetch when id is falsy 6ms[***m
       ✓ should create CONTRACT drawing and show success toast 11ms[***m
       ✓ should create SHOP drawing and show success toast 6ms[***m
       ✓ should show error toast on failure 7ms[***m
 ❯ hooks/__tests__/use-users.test.ts ([***m10 tests[***m | [***m1 failed)[***m 311ms[***m
       ✓ should generate correct cache keys 5ms[***m
       ✓ should fetch users successfully 94ms[***m
       ✓ should handle error state 62ms[***m
       ✓ should fetch roles successfully 66ms[***m
       ✓ should create user and show success toast 15ms[***m
       ✓ should show error toast on failure 7ms[***m
       × should update user and show success toast 23ms[***m
       ✓ should show error toast on failure 7ms[***m
       ✓ should delete user and show success toast 14ms[***m
       ✓ should show error toast on delete failure 8ms[***m
 ❯ hooks/__tests__/use-projects.test.ts ([***m10 tests[***m | [***m1 failed)[***m 321ms[***m
       ✓ should generate correct cache keys 6ms[***m
       ✓ should fetch projects successfully 98ms[***m
       ✓ should fetch projects without params 62ms[***m
       ✓ should handle error state 61ms[***m
       ✓ should create project and show success toast 13ms[***m
       ✓ should show error toast on failure 8ms[***m
       × should update project and show success toast 34ms[***m
       ✓ should show error toast on failure 7ms[***m
       ✓ should delete project and show success toast 10ms[***m
       ✓ should show error toast on delete failure 13ms[***m
 ❯ lib/services/__tests__/correspondence.service.test.ts ([***m11 tests[***m | [***m2 failed)[***m 52ms[***m
       ✓ should call GET /correspondences with params 9ms[***m
       ✓ should call GET /correspondences without params 1ms[***m
       × should call GET /correspondences/:id 10ms[***m
       × should work with string id 4ms[***m
       ✓ should call POST /correspondences with data 2ms[***m
       ✓ should call PUT /correspondences/:id with data 1ms[***m
       ✓ should call DELETE /correspondences/:id 1ms[***m
       ✓ should call POST /correspondences/:id/submit 1ms[***m
       ✓ should call POST /correspondences/:id/workflow 2ms[***m
       ✓ should call POST /correspondences/:id/references 1ms[***m
       ✓ should call DELETE /correspondences/:id/references with body 3ms[***m
 ❯ hooks/__tests__/use-rfa.test.ts ([***m10 tests[***m | [***m3 failed)[***m 1316ms[***m
       ✓ should generate correct cache keys 9ms[***m
       ✓ should fetch RFAs successfully 114ms[***m
       ✓ should handle error state 61ms[***m
       × should fetch single RFA by id 1056ms[***m
       ✓ should not fetch when id is falsy 8ms[***m
       ✓ should create RFA and show success toast 18ms[***m
       ✓ should show error toast on failure 8ms[***m
       × should update RFA and invalidate cache 15ms[***m
       × should process workflow action and show toast 10ms[***m
       ✓ should handle workflow error 9ms[***m
 ❯ lib/services/__tests__/project.service.test.ts ([***m7 tests[***m | [***m2 failed)[***m 27ms[***m
       ✓ should call GET /projects with params 9ms[***m
       ✓ should unwrap paginated response 1ms[***m
       × should call GET /projects/:id 7ms[***m
       × should work with string id 2ms[***m
       ✓ should call POST /projects with data 2ms[***m
       ✓ should call PUT /projects/:id with data 1ms[***m
       ✓ should call DELETE /projects/:id 1ms[***m
 ✓ components/ui/__tests__/button.test.tsx ([***m17 tests[***m)[***m 785ms[***m
       ✓[***m should render with default variant and size  389ms[***m
⎯⎯⎯⎯⎯⎯ Failed Tests 17 [***m⎯⎯⎯⎯⎯⎯⎯
 FAIL [***m hooks/__tests__/use-correspondence.test.ts > [***muse-correspondence hooks > [***museCorrespondence >
AssertionError[***m: expected false to be true // Object.is equality
Ignored nodes: comments, script, style
<html>
  <head />
  <body>
    <div />
  </body>
</html>
- Expected
+ Received
- true
+ false
 ❯[***m hooks/__tests__/use-correspondence.test.ts:92:42[***m
     90|
     91|       await waitFor(() => {
     92|         expect(result.current.isSuccess).toBe(true);
       |                                          ^
     93|       });
     94|
 ❯[***m runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12[***m
 ❯[***m checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77[***m
 ❯[***m Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16[***m
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/17]⎯[***m
 FAIL [***m hooks/__tests__/use-correspondence.test.ts > [***muse-correspondence hooks > [***museUpdateCorrespondence >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, …(1) ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "subject": "Updated Correspondence",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-correspondence.test.ts:181:44[***m
    179|       });
    180|
    181|       expect(correspondenceService.update).toHaveBeenCalledWith(1, {
       |                                            ^
    182|         subject: 'Updated Correspondence',
    183|       });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/17]⎯[***m
 FAIL [***m hooks/__tests__/use-correspondence.test.ts > [***muse-correspondence hooks > [***museSubmitCorrespondence >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { note: 'Ready for review' } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "note": "Ready for review",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-correspondence.test.ts:219:44[***m
    217|       });
    218|
    219|       expect(correspondenceService.submit).toHaveBeenCalledWith(1, { n…
       |                                            ^
    ***0|       expect(toast.success).toHaveBeenCalledWith('Correspondence submi…
    ***1|     });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/17]⎯[***m
 FAIL [***m hooks/__tests__/use-correspondence.test.ts > [***muse-correspondence hooks > [***museProcessWorkflow >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { action: 'APPROVE', …(1) } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "action": "APPROVE",
      "comments": "LGTM",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-correspondence.test.ts:239:53[***m
    237|       });
    238|
    239|       expect(correspondenceService.processWorkflow).toHaveBeenCalledWi…
       |                                                     ^
    240|         action: 'APPROVE',
    241|         comments: 'LGTM',
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/17]⎯[***m
 FAIL [***m hooks/__tests__/use-drawing.test.ts > [***muse-drawing hooks > [***museDrawings >
AssertionError[***m: expected { …(2) } to deeply equal { …(2) }
- Expected
+ Received
@@ -1,14 +1,18 @@
  {
    "data": [
      {
-       "drawingNumber": "CD-001",
+       "drawingNumber": undefined,
        "id": 1,
+       "type": "CONTRACT",
+       "uuid": 1,
      },
      {
-       "drawingNumber": "CD-002",
+       "drawingNumber": undefined,
        "id": 2,
+       "type": "CONTRACT",
+       "uuid": 2,
      },
    ],
    "meta": {
      "limit": 10,
      "page": 1,
 ❯[***m hooks/__tests__/use-drawing.test.ts:64:35[***m
     62|       });
     63|
     64|       expect(result.current.data).toEqual(mockData);
       |                                   ^
     65|       expect(contractDrawingService.getAll).toHaveBeenCalledWith({ pro…
     66|       expect(shopDrawingService.getAll).not.toHaveBeenCalled();
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/17]⎯[***m
 FAIL [***m hooks/__tests__/use-drawing.test.ts > [***muse-drawing hooks > [***museDrawings >
AssertionError[***m: expected { data: [ { id: 1, …(7) } ], …(1) } to deeply equal { data: [ { id: 1, …(1) } ], …(1) }
- Expected
+ Received
@@ -1,10 +1,16 @@
  {
    "data": [
      {
+       "currentRevisionUuid": undefined,
        "drawingNumber": "SD-001",
        "id": 1,
+       "legacyDrawingNumber": undefined,
+       "revision": undefined,
+       "title": "Untitled",
+       "type": "SHOP",
+       "uuid": 1,
      },
    ],
    "meta": {
      "limit": 10,
      "page": 1,
 ❯[***m hooks/__tests__/use-drawing.test.ts:84:35[***m
     82|       });
     83|
     84|       expect(result.current.data).toEqual(mockData);
       |                                   ^
     85|       expect(shopDrawingService.getAll).toHaveBeenCalledWith({ project…
     86|       expect(contractDrawingService.getAll).not.toHaveBeenCalled();
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/17]⎯[***m
 FAIL [***m hooks/__tests__/use-drawing.test.ts > [***muse-drawing hooks > [***museDrawing >
AssertionError[***m: expected false to be true // Object.is equality
Ignored nodes: comments, script, style
<html>
  <head />
  <body>
    <div />
  </body>
</html>
- Expected
+ Received
- true
+ false
 ❯[***m hooks/__tests__/use-drawing.test.ts:111:42[***m
    109|
    110|       await waitFor(() => {
    111|         expect(result.current.isSuccess).toBe(true);
       |                                          ^
    112|       });
    113|
 ❯[***m runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12[***m
 ❯[***m checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77[***m
 ❯[***m Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16[***m
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/17]⎯[***m
 FAIL [***m hooks/__tests__/use-drawing.test.ts > [***muse-drawing hooks > [***museDrawing >
AssertionError[***m: expected false to be true // Object.is equality
Ignored nodes: comments, script, style
<html>
  <head />
  <body>
    <div />
  </body>
</html>
- Expected
+ Received
- true
+ false
 ❯[***m hooks/__tests__/use-drawing.test.ts:126:42[***m
    124|
    125|       await waitFor(() => {
    126|         expect(result.current.isSuccess).toBe(true);
       |                                          ^
    127|       });
    128|
 ❯[***m runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12[***m
 ❯[***m checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77[***m
 ❯[***m Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16[***m
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/17]⎯[***m
 FAIL [***m hooks/__tests__/use-projects.test.ts > [***muse-projects hooks > [***museUpdateProject >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { name: 'Updated Project' } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "name": "Updated Project",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-projects.test.ts:144:37[***m
    142|       });
    143|
    144|       expect(projectService.update).toHaveBeenCalledWith(1, { name: 'U…
       |                                     ^
    145|       expect(toast.success).toHaveBeenCalledWith('Project updated succ…
    146|     });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/17]⎯[***m
 FAIL [***m hooks/__tests__/use-rfa.test.ts > [***muse-rfa hooks > [***museRFA >
AssertionError[***m: expected false to be true // Object.is equality
Ignored nodes: comments, script, style
<html>
  <head />
  <body>
    <div />
  </body>
</html>
- Expected
+ Received
- true
+ false
 ❯[***m hooks/__tests__/use-rfa.test.ts:78:42[***m
     76|
     77|       await waitFor(() => {
     78|         expect(result.current.isSuccess).toBe(true);
       |                                          ^
     79|       });
     80|
 ❯[***m runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12[***m
 ❯[***m checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77[***m
 ❯[***m Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16[***m
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/17]⎯[***m
 FAIL [***m hooks/__tests__/use-rfa.test.ts > [***muse-rfa hooks > [***museUpdateRFA >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { subject: 'Updated RFA' } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "subject": "Updated RFA",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-rfa.test.ts:159:33[***m
    157|       });
    158|
    159|       expect(rfaService.update).toHaveBeenCalledWith(1, { subject: 'Up…
       |                                 ^
    160|       expect(toast.success).toHaveBeenCalledWith('RFA updated successf…
    161|     });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/17]⎯[***m
 FAIL [***m hooks/__tests__/use-rfa.test.ts > [***muse-rfa hooks > [***museProcessRFA >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { action: 'APPROVE', …(1) } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "action": "APPROVE",
      "comments": "Approved",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-rfa.test.ts:179:42[***m
    177|       });
    178|
    179|       expect(rfaService.processWorkflow).toHaveBeenCalledWith(1, {
       |                                          ^
    180|         action: 'APPROVE',
    181|         comments: 'Approved',
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/17]⎯[***m
 FAIL [***m hooks/__tests__/use-users.test.ts > [***muse-users hooks > [***museUpdateUser >
AssertionError[***m: expected "vi.fn()" to be called with arguments: [ 1, { email: 'updated@example.com' } ]
Received:
  1st vi.fn() call:
[***m  [
-   1,
+   undefined,
    {
      "email": "updated@example.com",
    },
  ]
Number of calls: 1
 ❯[***m hooks/__tests__/use-users.test.ts:154:34[***m
    152|       });
    153|
    154|       expect(userService.update).toHaveBeenCalledWith(1, { email: 'upd…
       |                                  ^
    155|       expect(toast.success).toHaveBeenCalledWith('User updated success…
    156|     });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[13/17]⎯[***m
 FAIL [***m lib/services/__tests__/correspondence.service.test.ts > [***mcorrespondenceService > [***mgetById > [***mshould call GET /correspondences/:id
TypeError[***m: correspondenceService.getById is not a function
 ❯[***m lib/services/__tests__/correspondence.service.test.ts:47:50[***m
     45|       vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockD…
     46|
     47|       const result = await correspondenceService.getById(1);
       |                                                  ^
     48|
     49|       expect(apiClient.get).toHaveBeenCalledWith('/correspondences/1');
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[14/17]⎯[***m
 FAIL [***m lib/services/__tests__/correspondence.service.test.ts > [***mcorrespondenceService > [***mgetById >
TypeError[***m: correspondenceService.getById is not a function
 ❯[***m lib/services/__tests__/correspondence.service.test.ts:57:35[***m
     55|       vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockD…
     56|
     57|       await correspondenceService.getById('123');
       |                                   ^
     58|
     59|       expect(apiClient.get).toHaveBeenCalledWith('/correspondences/123…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[15/17]⎯[***m
 FAIL [***m lib/services/__tests__/project.service.test.ts > [***mprojectService > [***mgetById > [***mshould call GET /projects/:id
TypeError[***m: projectService.getById is not a function
 ❯[***m lib/services/__tests__/project.service.test.ts:42:43[***m
     40|       vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse …
     41|
     42|       const result = await projectService.getById(1);
       |                                           ^
     43|
     44|       expect(apiClient.get).toHaveBeenCalledWith('/projects/1');
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[16/17]⎯[***m
 FAIL [***m lib/services/__tests__/project.service.test.ts > [***mprojectService > [***mgetById >
TypeError[***m: projectService.getById is not a function
 ❯[***m lib/services/__tests__/project.service.test.ts:51:28[***m
     49|       vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
     50|
     51|       await projectService.getById('123');
       |                            ^
     52|
     53|       expect(apiClient.get).toHaveBeenCalledWith('/projects/123');
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[17/17]⎯[***m
 Test Files [***m 7 failed[***m | [***m2 passed[***m (9)
      Tests [***m 17 failed[***m | [***m96 passed[***m (113)
   Start at [***m 02:27:55
   Duration [***m 13.91s (transform 1.12s, setup 1.81s, import 3.69s, tests 6.52s, environment 23.02s)
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-correspondence.test.ts,title=hooks/__tests__/use-correspondence.test.ts > use-correspondence hooks > useCorrespondence > should fetch single correspondence by id,line=92,column=42::AssertionError: expected false to be true // Object.is equality%0A%0AIgnored nodes: comments, script, style%0A<html>%0A  <head />%0A  <body>%0A    <div />%0A  </body>%0A</html>%0A%0A- Expected%0A+ Received%0A%0A- true%0A+ false%0A%0A ❯ hooks/__tests__/use-correspondence.test.ts:92:42%0A ❯ runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12%0A ❯ checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77%0A ❯ Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-correspondence.test.ts,title=hooks/__tests__/use-correspondence.test.ts > use-correspondence hooks > useUpdateCorrespondence > should update correspondence and invalidate cache,line=181,column=44::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, …(1) ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "subject": "Updated Correspondence",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-correspondence.test.ts:181:44%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-correspondence.test.ts,title=hooks/__tests__/use-correspondence.test.ts > use-correspondence hooks > useSubmitCorrespondence > should submit correspondence for workflow,line=219,column=44::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { note: 'Ready for review' } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "note": "Ready for review",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-correspondence.test.ts:219:44%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-correspondence.test.ts,title=hooks/__tests__/use-correspondence.test.ts > use-correspondence hooks > useProcessWorkflow > should process workflow action,line=239,column=53::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { action: 'APPROVE', …(1) } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "action": "APPROVE",%0A      "comments": "LGTM",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-correspondence.test.ts:239:53%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-drawing.test.ts,title=hooks/__tests__/use-drawing.test.ts > use-drawing hooks > useDrawings > should fetch CONTRACT drawings successfully,line=64,column=35::AssertionError: expected { …(2) } to deeply equal { …(2) }%0A%0A- Expected%0A+ Received%0A%0A@@ -1,14 +1,18 @@%0A  {%0A    "data": [%0A      {%0A-       "drawingNumber": "CD-001",%0A+       "drawingNumber": undefined,%0A        "id": 1,%0A+       "type": "CONTRACT",%0A+       "uuid": 1,%0A      },%0A      {%0A-       "drawingNumber": "CD-002",%0A+       "drawingNumber": undefined,%0A        "id": 2,%0A+       "type": "CONTRACT",%0A+       "uuid": 2,%0A      },%0A    ],%0A    "meta": {%0A      "limit": 10,%0A      "page": 1,%0A%0A ❯ hooks/__tests__/use-drawing.test.ts:64:35%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-drawing.test.ts,title=hooks/__tests__/use-drawing.test.ts > use-drawing hooks > useDrawings > should fetch SHOP drawings successfully,line=84,column=35::AssertionError: expected { data: [ { id: 1, …(7) } ], …(1) } to deeply equal { data: [ { id: 1, …(1) } ], …(1) }%0A%0A- Expected%0A+ Received%0A%0A@@ -1,10 +1,16 @@%0A  {%0A    "data": [%0A      {%0A+       "currentRevisionUuid": undefined,%0A        "drawingNumber": "SD-001",%0A        "id": 1,%0A+       "legacyDrawingNumber": undefined,%0A+       "revision": undefined,%0A+       "title": "Untitled",%0A+       "type": "SHOP",%0A+       "uuid": 1,%0A      },%0A    ],%0A    "meta": {%0A      "limit": 10,%0A      "page": 1,%0A%0A ❯ hooks/__tests__/use-drawing.test.ts:84:35%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-drawing.test.ts,title=hooks/__tests__/use-drawing.test.ts > use-drawing hooks > useDrawing > should fetch single CONTRACT drawing by id,line=111,column=42::AssertionError: expected false to be true // Object.is equality%0A%0AIgnored nodes: comments, script, style%0A<html>%0A  <head />%0A  <body>%0A    <div />%0A  </body>%0A</html>%0A%0A- Expected%0A+ Received%0A%0A- true%0A+ false%0A%0A ❯ hooks/__tests__/use-drawing.test.ts:111:42%0A ❯ runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12%0A ❯ checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77%0A ❯ Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-drawing.test.ts,title=hooks/__tests__/use-drawing.test.ts > use-drawing hooks > useDrawing > should fetch single SHOP drawing by id,line=126,column=42::AssertionError: expected false to be true // Object.is equality%0A%0AIgnored nodes: comments, script, style%0A<html>%0A  <head />%0A  <body>%0A    <div />%0A  </body>%0A</html>%0A%0A- Expected%0A+ Received%0A%0A- true%0A+ false%0A%0A ❯ hooks/__tests__/use-drawing.test.ts:126:42%0A ❯ runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12%0A ❯ checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77%0A ❯ Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-projects.test.ts,title=hooks/__tests__/use-projects.test.ts > use-projects hooks > useUpdateProject > should update project and show success toast,line=144,column=37::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { name: 'Updated Project' } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "name": "Updated Project",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-projects.test.ts:144:37%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-rfa.test.ts,title=hooks/__tests__/use-rfa.test.ts > use-rfa hooks > useRFA > should fetch single RFA by id,line=78,column=42::AssertionError: expected false to be true // Object.is equality%0A%0AIgnored nodes: comments, script, style%0A<html>%0A  <head />%0A  <body>%0A    <div />%0A  </body>%0A</html>%0A%0A- Expected%0A+ Received%0A%0A- true%0A+ false%0A%0A ❯ hooks/__tests__/use-rfa.test.ts:78:42%0A ❯ runWithExpensiveErrorDiagnosticsDisabled ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/config.js:47:12%0A ❯ checkCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:124:77%0A ❯ Timeout.checkRealTimersCallback ../node_modules/.pnpm/@testing-library+dom@10.4.1/node_modules/@testing-library/dom/dist/wait-for.js:118:16%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-rfa.test.ts,title=hooks/__tests__/use-rfa.test.ts > use-rfa hooks > useUpdateRFA > should update RFA and invalidate cache,line=159,column=33::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { subject: 'Updated RFA' } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "subject": "Updated RFA",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-rfa.test.ts:159:33%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-rfa.test.ts,title=hooks/__tests__/use-rfa.test.ts > use-rfa hooks > useProcessRFA > should process workflow action and show toast,line=179,column=42::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { action: 'APPROVE', …(1) } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "action": "APPROVE",%0A      "comments": "Approved",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-rfa.test.ts:179:42%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/hooks/__tests__/use-users.test.ts,title=hooks/__tests__/use-users.test.ts > use-users hooks > useUpdateUser > should update user and show success toast,line=154,column=34::AssertionError: expected "vi.fn()" to be called with arguments: [ 1, { email: 'updated@example.com' } ]%0A%0AReceived:%0A%0A  1st vi.fn() call:%0A%0A  [%0A-   1,%0A+   undefined,%0A    {%0A      "email": "updated@example.com",%0A    },%0A  ]%0A%0A%0ANumber of calls: 1%0A%0A ❯ hooks/__tests__/use-users.test.ts:154:34%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/lib/services/__tests__/correspondence.service.test.ts,title=lib/services/__tests__/correspondence.service.test.ts > correspondenceService > getById > should call GET /correspondences/%3Aid,line=47,column=50::TypeError: correspondenceService.getById is not a function%0A ❯ lib/services/__tests__/correspondence.service.test.ts:47:50%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/lib/services/__tests__/correspondence.service.test.ts,title=lib/services/__tests__/correspondence.service.test.ts > correspondenceService > getById > should work with string id,line=57,column=35::TypeError: correspondenceService.getById is not a function%0A ❯ lib/services/__tests__/correspondence.service.test.ts:57:35%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/lib/services/__tests__/project.service.test.ts,title=lib/services/__tests__/project.service.test.ts > projectService > getById > should call GET /projects/%3Aid,line=42,column=43::TypeError: projectService.getById is not a function%0A ❯ lib/services/__tests__/project.service.test.ts:42:43%0A%0A
::error file=/workspace/np-dms/lcbp3/frontend/lib/services/__tests__/project.service.test.ts,title=lib/services/__tests__/project.service.test.ts > projectService > getById > should work with string id,line=51,column=28::TypeError: projectService.getById is not a function%0A ❯ lib/services/__tests__/project.service.test.ts:51:28%0A%0A
 ELIFECYCLE  Test failed. See above for more details.
  ❌  Failure - Main 🧪 Run Tests
exitcode '1': failure
🏗️ Verify Build
