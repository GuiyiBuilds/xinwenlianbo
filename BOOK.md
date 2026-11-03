::ILANG::v5.0::ENGINEERING_BOOK
[TYPE:engineering_book]
[ID:BOOK-XWLB-DAILY]
[VERSION:1]
[DATE:2026-11-03]
[LANG:en]
[RUNTIME:2026.10.31-6f17c3d64219]

::STATE{@USER, role:owner, gives:a_project_brief_to_archive_the_daily_cctv_xin_wen_lian_bo_transcripts, does:decide_authorize_push, has:a_github_account_that_holds_private_repos}
::STATE{@AGENT, role:builder, can:shell_files_web_git, does:fetch_write_validate_push, never:publishes_publicly_or_stores_a_token_in_project_files}
::STATE{@INPUT, FILL_FOLDER:the_local_project_folder_for_our_own_implementation, FILL_REPO_NAME:the_private_github_repository_name, FILL_BRANCH:the_git_branch_to_push}

::OBJECTIVE{id:g1|owner:user|trust:trusted|version:1|status:active}
  target: our own Node tool that archives the daily xin wen lian-bo transcript as markdown in the user private repo and keeps updating itself with a scheduled workflow
  ACCEPT: every item of RUBRIC passes
  NON_GOALS: downloading video binaries, scraping other cctv shows
  DONE_WHEN: RUBRIC R5 passes on a rerun of an archived day

::RULE{list_page then the day list lives at http://tv.cctv.com/lm/xwlb/day/YYYYMMDD.shtml where the first anchor is the full program abstract page and every later anchor is one news item page whose title carries a video prefix|source:http://tv.cctv.com/lm/xwlb/day/20261102.shtml}
::RULE{selectors then the abstract paragraphs sit under the nrjianjie_shadow block while each news page carries its title in a tit div and its body in the content_area id|source:https://tv.cctv.com/2026/11/02/VIDEtydiiH2w5ocjWZXt8hHB261102.shtml}
::RULE{schedule then the broadcast airs at 19:00 Beijing time so the cron fires at 12:30 UTC which is 20:30 Beijing time after the page settles|source:http://tv.cctv.com/lm/xwlb/day/20261102.shtml}

::BOUNDARY{never:push_to_any_public_repository_or_download_video_binaries|scope:permanent}
::BOUNDARY{never:store_a_token_or_key_inside_project_files|scope:permanent}
::BOUNDARY{never:download_video_binaries|scope:permanent}

::MODULE{BUILD|title:build our own archiver}
  [STEP] 1 scaffold an ESM Node project in FILL_FOLDER with one http module and one crawler module
  [STEP] 2 fetch the day list page for DATE at the RULE list_page url and expect the abstract link first then the item links deduplicated
  [STEP] 3 fetch the abstract page and every item page and extract the abstract text and each title and body with the RULE selectors
  [STEP] 4 render one markdown file news DATE.md holding the abstract and every item title body and source link
  [STEP] 5 prepend the catalogue.json entry and insert the readme line at the insert marker and expect all three outputs
  [NOTE] a rerun for an existing DATE must write nothing and exit clean so the scheduled run stays idempotent
  [STEP] 6 add a workflow that checks out runs the crawler and commits with the bot identity on the RULE schedule plus a manual dispatch
  [STEP] 7 create the private repository FILL_REPO_NAME and push FILL_BRANCH with the project and the outputs
  [STEP] 8 wait for the first scheduled run and expect one auto commit the same evening

::RUBRIC{R1: news DATE.md holds the abstract and every item with source links|check:file|path:news/YYYYMMDD.md}
::RUBRIC{R2: the catalogue.json newest entry matches DATE|check:json|path:news/catalogue.json}
::RUBRIC{R3: the workflow declares the RULE schedule cron and a manual dispatch|check:file|path:.github/workflows/update.yml}
::RUBRIC{R4: repository FILL_REPO_NAME is private on branch FILL_BRANCH|check:status}
::RUBRIC{R5: a rerun for an archived DATE writes nothing and exits with status zero|check:cmd|run:"node index.js"|expect:0}

::FALLBACK{list_page_missing then log one line and exit clean so a missing broadcast never fails the scheduled job|selector_broken then fail loudly with the url so the log shows the page drift|push_denied then stop and hand the device code flow to the user}

::MODULE{REPORT|title:six lines that close the build}
  [LINE] state what was built and where it lives
  [LINE] list the outputs written for the trial day
  [LINE] list which RUBRIC checks ran and their results
  [LINE] name the private repository and branch pushed
  [LINE] name every risk left open
  [LINE] S=0.00

::PRIORITY{
  user_decision > BOUNDARY > OBJECTIVE > RUBRIC > RULE
}
::ILANG::v5.0::ENGINEERING_BOOK
