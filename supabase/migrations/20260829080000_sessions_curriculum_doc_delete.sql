-- sessions.curriculum_doc_id had no ON DELETE clause, so deleting a curriculum_docs
-- row that was ever assigned to a session raised a raw FK violation instead of
-- failing gracefully. Sessions should survive the doc's deletion and just lose
-- the reference.
alter table sessions drop constraint sessions_curriculum_doc_id_fkey;
alter table sessions add constraint sessions_curriculum_doc_id_fkey
  foreign key (curriculum_doc_id) references curriculum_docs (id) on delete set null;
