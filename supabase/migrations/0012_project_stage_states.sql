-- 案件の状態に「一時停止(paused)」「削除(closed)」を追加する。
-- recruiting=募集中 / paused=一時停止 / matched=選定済み / closed=削除（掲載終了・論理削除）。
-- 掲載の一時停止・再開・削除は元請のみ。削除は選定済み(matched)には不可。
-- べき等：制約を張り替えるだけ。

alter table projects drop constraint if exists projects_stage_check;
alter table projects add constraint projects_stage_check
  check (stage in ('recruiting', 'paused', 'matched', 'closed'));
