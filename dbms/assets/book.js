// Web book shell (table of contents + prev/next) and the figure helpers shared by every chapter.
const BOOK = {
  parts: [
    { group: 'Ishrak sir\'s part (Lec 01–15)' },
    { title: 'Lec 01 · DBMS introduction', chapters: [
      ['i01/01-data-and-dbms.html', 'Data, databases and the DBMS', 's.1–11'],
      ['i01/02-files-vs-dbms.html', 'Files, spreadsheets or a DBMS?', 's.12–17'],
      ['i01/03-reliability-and-control.html', 'Many users, crashes and security', 's.18–24'],
    ] },
    { title: 'Lec 02 · Relational and non-relational models', chapters: [
      ['i02/01-two-models.html', 'Two ways to model data', 's.1–4'],
      ['i02/02-relational-tables.html', 'Relational tables and joins', 's.5–8'],
      ['i02/03-keys.html', 'Keys: identifying and connecting rows', 's.5–7'],
      ['i02/04-document-model.html', 'The document model and duplication', 's.9–10, 14–15'],
      ['i02/05-other-nosql-models.html', 'Key–value, graph and the comparison', 's.11–13, 16'],
      ['i02/06-beyond-architecture.html', 'Architecture and data abstraction', 'exam'],
      ['i02/07-beyond-the-slides.html', 'XML, MapReduce, distributed data', 'exam'],
    ] },
    { title: 'Lec 03 · SQL introduction and DDL', chapters: [
      ['i03/01-relational-and-sql.html', 'SQL and relational databases', 's.1–9'],
      ['i03/02-tables-and-schemas.html', 'Tables, schemas and domains', 's.10–14'],
      ['i03/03-character-and-number-types.html', 'Character and number types', 's.15–20'],
      ['i03/04-dates.html', 'Dates in Oracle', 's.21–26'],
      ['i03/05-null-and-create-table.html', 'NULL and CREATE TABLE', 's.27–34'],
      ['i03/06-keys-and-insert.html', 'Keys, PRIMARY KEY, UNIQUE and INSERT', 's.35–44'],
    ] },
    { title: 'Lec 04 · SELECT, WHERE and comparisons', chapters: [
      ['i04/01-select-from.html', 'SELECT and FROM', 's.1–11'],
      ['i04/02-where-and-evaluation-order.html', 'WHERE and the order of evaluation', 's.12–18'],
      ['i04/03-comparisons-and-between.html', 'Comparisons, BETWEEN, string equality', 's.19–25'],
    ] },
    { title: 'Lec 04 · LIKE, logic, ordering and NULL', chapters: [
      ['i04/04-like.html', 'Pattern matching with LIKE', 's.26–35'],
      ['i04/05-and-or-not.html', 'AND, OR, NOT and precedence', 's.36–40'],
      ['i04/06-order-by.html', 'Sorting with ORDER BY', 's.41–43'],
      ['i04/07-in-and-not-in.html', 'IN and NOT IN', 's.44–45'],
      ['i04/08-null-and-three-valued-logic.html', 'NULL and three-valued logic', 'book'],
    ] },
    { title: 'Lec 05 · DML: insert, delete, update', chapters: [
      ['i05/01-insert-and-copy.html', 'INSERT, bulk insert, copying tables', 's.1–6'],
      ['i05/02-delete.html', 'Deleting rows', 's.7–11'],
      ['i05/03-update.html', 'Modifying rows with UPDATE', 's.12–15'],
      ['i05/04-alter-drop-functions.html', 'ALTER, DROP, DEFAULT and functions', 'exam'],
      ['i05/05-beyond-the-slides.html', 'Views, privileges and roles', 'exam'],
    ] },
    { title: 'Lec 06 · Constraints I: keys and foreign keys', chapters: [
      ['i06/01-keys-unique-not-null.html', 'Why constraints? Keys, UNIQUE and NOT NULL', 's.1–9'],
      ['i06/02-foreign-keys.html', 'Foreign keys', 's.10–13'],
      ['i06/03-enforcing-foreign-keys.html', 'Enforcing a foreign key: six kinds of change', 's.14–21'],
      ['i06/04-referential-actions.html', 'Referential actions: CASCADE and SET NULL', 's.22–23'],
    ] },
    { title: 'Lec 06 · Constraints II: CHECK, assertions, altering', chapters: [
      ['i06/05-check-constraints.html', 'CHECK constraints: attribute- and tuple-based', 's.24–36'],
      ['i06/06-assertions.html', 'Assertions', 's.37–50'],
      ['i06/07-naming-and-altering.html', 'Naming, altering, enabling constraints', 's.51–52'],
      ['i06/08-beyond-the-slides.html', 'Kinds of integrity constraints, deferred checking', 'exam'],
    ] },
    { title: 'Lec 07 · ER diagrams', chapters: [
      ['i07/01-what-is-an-erd.html', 'Entities, attributes, keys and relationships', 's.1–14'],
      ['i07/02-design-principles.html', 'Relationship attributes and design principles', 's.15–24'],
      ['i07/03-multiplicity.html', 'Multiplicity, roles and the notation summary', 's.25–34'],
      ['i07/04-movie-database.html', 'Building an ERD step by step: movies', 's.35–41'],
      ['i07/05-case-studies.html', 'Five case studies; relationship to entity', 's.42–60'],
      ['i07/06-multiway-relationships.html', 'Multi-way relationships and converting them to binary', 's.61–71'],
      ['i07/07-subclasses.html', 'Subclasses, isA and limits of key notation', 's.72–77'],
      ['i07/08-weak-entities.html', 'Weak entity sets', 's.78–85'],
      ['i07/09-practice-and-pitfalls.html', 'Practice, common mistakes, checklist', 's.86–98'],
    ] },
    { title: 'Lec 07 · ER to relational schema', chapters: [
      ['i07/10-attributes-and-participation.html', 'Attribute kinds, participation, other notations', 'exam'],
      ['i07/11-er-to-relational.html', 'From ER diagram to tables, rule by rule', 'exam'],
      ['i07/12-converting-hierarchies.html', 'Converting isA hierarchies to tables', 'exam'],
      ['i07/13-er-to-schema-tool.html', 'ER to schema converter (tool)', 'tool'],
    ] },
    { title: 'Lec 07 · ER design workshop', chapters: [
      ['i07/14-workshop-libraries.html', 'Workshop I: libraries, employees, shipping', 'exam'],
      ['i07/15-workshop-universities.html', 'Workshop II: universities, research, pharmacies', 'exam'],
      ['i07/16-workshop-platforms.html', 'Workshop III: YouTube, BPL, hospital', 'exam'],
      ['i07/17-beyond-the-slides.html', 'Materialized views, object types', 'exam'],
    ] }, 
    { title: 'Lec 08 · Queries over multiple tables', chapters: [
      ['i08/01-why-multiple-tables.html', 'Why data lives in several tables', 's.1–6'],
      ['i08/02-cross-product-and-join.html', 'Cross product and join', 's.7–12'],
      ['i08/03-join-queries.html', 'Writing join queries', 's.13–19'],
      ['i08/04-tuple-variables.html', 'Tuple variables and self-joins', 's.20–22'],
      ['i08/05-set-operations.html', 'UNION, INTERSECT and MINUS', 's.23–30'],
      ['i08/06-bags-and-all.html', 'Sets, bags and the ALL keyword', 's.31–36'],
    ] },
    { title: 'Lec 09 · Inner and outer joins', chapters: [
      ['i09/01-join-types.html', 'Inner and outer joins', 's.1–6'],
      ['i09/02-outer-join-queries.html', 'Answering questions with outer joins', 's.7–19'],
    ] },
    { title: 'Lec 10 · Aggregation and grouping', chapters: [
      ['i10/01-formulas-and-nulls.html', 'Formulas, NULLs and three-valued logic', 's.1–12'],
      ['i10/02-aggregation.html', 'Aggregate functions', 's.13–18'],
      ['i10/03-group-by-having.html', 'GROUP BY and HAVING', 's.19–27'],
      ['i10/04-grouping-examples.html', 'Grouping examples on the computer database', 's.28–37'],
    ] },
    { title: 'Lec 11 · Subqueries', chapters: [
      ['i11/01-subqueries-in-where.html', 'Subqueries in WHERE; ALL and ANY', 's.1–7'],
      ['i11/02-correlated-subqueries.html', 'Nested and correlated subqueries', 's.8–12'],
      ['i11/03-exists.html', 'EXISTS and NOT EXISTS', 's.13–16'],
      ['i11/04-subqueries-in-from.html', 'Subqueries in FROM and SELECT', 's.17–22'],
    ] },
    { title: 'Lec 08–11 · SQL exam practice', chapters: [
      ['i11/05-exam-practice-1.html', 'Exam practice I: multi-table queries', 'exam'],
      ['i11/06-exam-practice-2.html', 'Exam practice II: university, flights, hospital, projects', 'exam'],
      ['i11/07-beyond-the-slides.html', 'Advanced SQL beyond the slides', 'exam'],
    ] },
    { title: 'Lec 12 · Relational algebra', chapters: [
      ['i12/01-relational-algebra.html', 'Relational algebra and the SQL engine', 's.1–5'],
      ['i12/02-selection-projection.html', 'Selection and projection', 's.6–11'],
      ['i12/03-product-renaming.html', 'Cartesian product and renaming', 's.12–16'],
      ['i12/04-natural-join.html', 'Natural join and SQL to RA', 's.17–20'],
      ['i12/05-set-operations.html', 'Union, difference, intersection, division', 's.21–24'],
      ['i12/06-theta-outer-joins.html', 'Theta, equi-, outer and semi-joins', 's.25–27'],
      ['i12/07-query-trees.html', 'Query trees and logical optimization', 's.28–44'],
      ['i12/08-writing-queries.html', 'Writing queries in RA', 's.45–49'],
      ['i12/09-extended-ra.html', 'Extended RA: γ, τ, assignment, updates', 'exam'],
    ] },
    { title: 'Lec 12 · Triggers, procedures, functions', chapters: [
      ['i12/10-triggers.html', 'Triggers: syntax, row vs statement, :NEW/:OLD', 's.50–52'],
      ['i12/11-trigger-design.html', 'Designing triggers: mutating tables, INSTEAD OF', 'exam'],
      ['i12/12-procedures-functions.html', 'Procedures and functions', 'exam'],
    ] },
    { title: 'Lec 13 · Storage media and disks', chapters: [
      ['l13/01-storage-media.html', 'Physical storage media and the hierarchy', 's.2–4'],
      ['l13/02-disk-anatomy.html', 'Inside a magnetic hard disk', 's.5–7'],
      ['l13/03-access-time.html', 'Access time, blocks and IOPS', 's.8–10'],
      ['l13/04-relations-on-disk.html', 'Placing relations and counting seeks', 's.11'],
    ] },
    { title: 'Lec 13 · RAID', chapters: [
      ['l13/05-raid-and-striping.html', 'RAID and disk striping', 's.12–14'],
      ['l13/06-raid-0-and-1.html', 'RAID 0 and RAID 1', 's.15–16'],
      ['l13/07-raid-5-parity.html', 'RAID 5 and parity', 's.17–19'],
      ['l13/08-raid-6-and-choice.html', 'RAID 6 and choosing a level', 's.20–22'],
    ] },
    { title: 'Lec 13 · Beyond the slides', chapters: [
      ['l13/09-disk-scheduling.html', 'Disk-arm scheduling', 'exam'],
      ['l13/10-beyond-the-slides.html', 'Other exam topics: storage and RAID', 'exam'],
    ] },
    { title: 'Lec 14 · Records in files', chapters: [
      ['l14/01-files-and-records.html', 'Files, records and fields', 's.2'],
      ['l14/02-fixed-length-records.html', 'Fixed-length records: finding a record', 's.3–5'],
      ['l14/03-deleting-records.html', 'Deleting fixed-length records', 's.6–10'],
    ] },
    { title: 'Lec 14 · Variable-length records', chapters: [
      ['l14/04-variable-length-records.html', 'Variable-length records', 's.11–13'],
      ['l14/05-slotted-page.html', 'Slotted page structure', 's.14–16'],
      ['l14/06-large-objects.html', 'Storing large objects', 's.17'],
    ] },
    { title: 'Lec 14 · Organizing files', chapters: [
      ['l14/07-multitable-clustering.html', 'Multitable clustering', 's.18–19'],
      ['l14/08-data-dictionary.html', 'Data dictionary', 's.20–22'],
    ] },
    { title: 'Lec 14 · Column storage', chapters: [
      ['l14/09-column-storage.html', 'Column-oriented storage', 's.23–26'],
      ['l14/10-compressed-columns.html', 'Compression, and when to use columns', 's.27–30'],
      ['l14/11-orc-parquet.html', 'ORC and Parquet files', 's.31'],
      ['l14/12-file-organization-partitioning.html', 'File organization and table partitioning', 'exam'],
    ] },
    { title: 'Lec 15 · Index basics', chapters: [
      ['l15/01-what-is-an-index.html', 'What an index is', 's.2–6'],
    ] },
    { title: 'Lec 15 · Ordered indices', chapters: [
      ['l15/02-dense-and-sparse.html', 'Primary, dense and sparse indices', 's.7–12'],
      ['l15/03-secondary-indices.html', 'Secondary indices', 's.13–15'],
      ['l15/04-multilevel-index.html', 'Multilevel indices', 's.16–17'],
      ['l15/05-index-update.html', 'Updating an index', 's.18–22'],
      ['l15/06-composite-keys.html', 'Indices on multiple keys', 's.23'],
    ] },
    { title: 'Lec 15 · B+ trees', chapters: [
      ['l15/07-why-bplus-trees.html', 'Why B+ trees', 's.24–25'],
      ['l15/08-bplus-structure.html', 'B+ tree structure', 's.26–30'],
      ['l15/09-bplus-search.html', 'Searching a B+ tree', 's.31–34'],
    ] },
    { title: 'Lec 15 · Beyond the slides: B+ tree updates', chapters: [
      ['l15/10-bplus-insertion.html', 'B+ tree insertion', 'exam'],
      ['l15/11-bplus-deletion.html', 'B+ tree deletion', 'exam'],
    ] },
    { title: 'Lec 15 · Beyond the slides: bitmaps and hashing', chapters: [
      ['l15/12-bitmap-indices.html', 'Bitmap indices', 'exam'],
      ['l15/13-static-hashing.html', 'Static hashing', 'exam'],
      ['l15/14-dynamic-hashing.html', 'Dynamic hashing: extendible and linear', 'exam'],
    ] },
    { group: 'Sukarna sir\'s part (Lec 01–08)' },
    { title: 'Lec 01 · FDs, keys and closure', chapters: [
      ['s01/01-why-design-theory.html', 'Why design theory: redundancy and decomposition', 's.1–5'],
      ['s01/02-functional-dependencies.html', 'Functional dependencies', 's.6–14'],
      ['s01/03-keys-and-superkeys.html', 'Keys, superkeys and primary keys', 's.15–19'],
      ['s01/04-fd-rules.html', 'Transitivity, splitting/combining, trivial FDs', 's.20–23'],
      ['s01/05-attribute-closure.html', 'Attribute closure', 's.24–27'],
      ['s01/06-finding-keys.html', 'Closures, superkeys and finding all keys', 's.28'],
      ['s01/07-armstrongs-axioms.html', "Armstrong's axioms and equivalent FD sets", 's.29–33'],
      ['s01/08-minimal-basis.html', 'Minimal basis (canonical cover)', 's.34–36'],
      ['s01/09-anomalies-and-decomposition.html', 'Anomalies and decomposition', 's.37–42'],
    ] },
    { title: 'Lec 01 · Normal forms and decomposition', chapters: [
      ['s01/10-projecting-fds.html', 'Projecting FDs', 's.43–44'],
      ['s01/11-bcnf.html', 'BCNF and BCNF decomposition', 's.45–50'],
      ['s01/12-lossless-join.html', 'Lossless joins and the chase', 's.51–52'],
      ['s01/13-dependency-preservation.html', 'Dependency preservation', 's.53–56'],
      ['s01/14-third-normal-form.html', 'Third normal form and 3NF synthesis', 's.57–59'],
      ['s01/15-multivalued-dependencies.html', 'Multivalued dependencies', 's.60–61'],
      ['s01/16-first-and-second-normal-form.html', '1NF, 2NF and 3NF step by step', 's.62–64'],
      ['s01/17-normalizing-tables.html', 'Workshop: normalizing real tables', 's.62–64'],
      ['s01/18-beyond-the-slides.html', 'Exam topics beyond the slides (4NF)', 'exam'],
    ] },
    { title: 'Lec 02 · Concurrency control I', chapters: [
      ['s02/01-why-concurrency-control.html', 'Why databases need concurrency control', 's.2–5'],
      ['s02/02-serial-and-serializable.html', 'Serial and serializable schedules', 's.6–14'],
      ['s02/03-conflicts.html', 'Conflicts and conflict-serializability', 's.15–21'],
      ['s02/04-precedence-graphs.html', 'Testing with a precedence graph', 's.22–25'],
      ['s02/05-why-the-test-works.html', 'Why the precedence-graph test works', 's.26–29'],
      ['s02/06-locks.html', 'Locks and the locking scheduler', 's.30–35'],
      ['s02/07-two-phase-locking.html', 'Two-phase locking', 's.36–41'],
    ] },
    { title: 'Lec 03 · Concurrency II: locking', chapters: [
      ['s03/01-shared-exclusive-locks.html', 'Shared and exclusive locks', 's.2–5'],
      ['s03/02-upgrades-and-update-locks.html', 'Lock upgrades and update locks', 's.6–9'],
      ['s03/03-lock-table.html', 'The lock table and locking scheduler', 's.10–14'],
    ] },
    { title: 'Lec 03 · Concurrency II: timestamps', chapters: [
      ['s03/04-timestamps.html', 'Timestamps and unrealizable behaviour', 's.15–23'],
      ['s03/05-timestamp-rules.html', 'Timestamp scheduling rules', 's.24–28'],
      ['s03/06-mvcc.html', 'MVCC, and timestamps vs locking', 's.29–34'],
      ['s03/07-isolation-levels.html', 'Transaction isolation levels', 's.35–37'],
      ['s03/08-beyond-the-slides.html', 'Exam topics beyond the slides', 'exam'],
    ] },
    { title: 'Lec 04 · Recoverability', chapters: [
      ['s04/01-dirty-data.html', 'Dirty data and cascading rollback', 's.1–5'],
      ['s04/02-recoverable-acr.html', 'Recoverable and ACR schedules', 's.6–9'],
      ['s04/03-strict-locking.html', 'Strict and rigorous 2PL', 's.10–12'],
      ['s04/04-group-commit.html', 'Group commit', 's.13–14'],
    ] },
    { title: 'Lec 04 · Deadlocks', chapters: [
      ['s04/05-deadlocks-waits-for.html', 'Deadlocks: timeouts and the waits-for graph', 's.15–20'],
      ['s04/06-element-ordering.html', 'Deadlock prevention by ordering', 's.21–24'],
      ['s04/07-wait-die-wound-wait.html', 'Wait-die and wound-wait', 's.25–29'],
      ['s04/08-comparing-deadlock-methods.html', 'Comparing deadlock methods; real DBMSs', 's.30–33'],
      ['s04/09-beyond-the-slides.html', 'Exam topics beyond the slides', 'exam'],
    ] },
    { title: 'Lec 05 · System failures I: undo logging', chapters: [
      ['s05/01-failure-modes.html', 'Failure modes', 's.2–6'],
      ['s05/02-transactions.html', 'Transactions, atomicity and consistency', 's.7–13'],
      ['s05/03-primitive-operations.html', 'INPUT, READ, WRITE, OUTPUT', 's.14–17'],
      ['s05/04-log-records.html', 'Log records and write-ahead logging', 's.18–21'],
      ['s05/05-undo-logging-rules.html', 'Undo logging: rules U1 and U2', 's.22–24'],
      ['s05/06-undo-recovery.html', 'Recovery using an undo log', 's.25–30'],
      ['s05/07-checkpointing.html', 'Checkpointing an undo log', 's.31–34'],
    ] },
    { title: 'Lec 06 · System failures II: redo, undo/redo', chapters: [
      ['s06/01-redo-logging.html', 'Redo logging and recovery', 's.2–6'],
      ['s06/02-redo-checkpointing.html', 'Checkpointing a redo log', 's.7–11'],
      ['s06/03-undo-redo-logging.html', 'Undo/redo logging', 's.12–16'],
      ['s06/04-undo-redo-checkpointing.html', 'Checkpointing an undo/redo log', 's.17–18'],
      ['s06/05-media-failures.html', 'Archiving and media failures', 's.19–23'],
      ['s06/06-beyond-the-slides.html', 'Exam topics beyond the slides', 'exam'],
    ] },
    { title: 'Lec 07 · Query execution I', chapters: [
      ['s07/01-query-processor.html', 'The query processor: SQL to physical plan', 's.1–12'],
      ['s07/02-table-structures.html', 'Heaps, clustered and non-clustered indexes', 's.13–18'],
      ['s07/03-scanning.html', 'Table scan, index scan, index seek, sort scan', 's.19–28'],
      ['s07/04-cost-model.html', 'Measuring cost: M, B, T, V', 's.29–34'],
      ['s07/05-iterators-pipelining.html', 'Iterators and pipelining', 's.29 + book'],
      ['s07/06-one-pass-unary.html', 'One-pass σ, π, δ, γ', 's.35–44'],
      ['s07/07-one-pass-binary.html', 'One-pass ∪, ∩, −, ×, ⋈', 's.45–54'],
    ] },
    { title: 'Lec 08 · Query execution II', chapters: [
      ['s08/01-nested-loop-joins.html', 'Nested-loop joins', 's.2–8'],
      ['s08/02-tpmms.html', 'Two-phase multiway merge sort', 's.9–13'],
      ['s08/03-sort-based-operations.html', 'Sort-based δ, γ, ∪, ∩, −', 's.14–21'],
      ['s08/04-sort-join.html', 'Sort-join and sort-merge-join', 's.22–28'],
      ['s08/05-hash-based.html', 'Two-pass hash-based algorithms', 's.29–35'],
      ['s08/06-choosing-a-join.html', 'Choosing a join algorithm', 'review'],
      ['s08/07-beyond-the-slides.html', 'Exam topics beyond the slides', 'exam'],
    ] },
  ],
};

// COMPULSORY-MAP (generated): chapters with Q1/Q5 questions
BOOK.compulsory = {"i06/05-check-constraints.html": ["2020–21 Q5(c)"], "i06/08-beyond-the-slides.html": ["2024–25 Q5(b)"], "i07/08-weak-entities.html": ["2017–18 Q5(c)"], "i07/12-converting-hierarchies.html": ["2017–18 Q5(b)"], "i07/14-workshop-libraries.html": ["2023–24 Q1(a)", "2023–24 Q1(b)"], "i07/15-workshop-universities.html": ["2019–20 Q5(a)", "2019–20 Q5(b)", "2017–18 Q5(a)"], "i07/16-workshop-platforms.html": ["2022–23 Q5(a)", "2022–23 Q5(b)"], "i08/05-set-operations.html": ["2020–21 Q5(a)"], "i11/03-exists.html": ["2021–22 Q1(b)"], "i11/05-exam-practice-1.html": ["2021–22 Q1(a)", "2020–21 Q5(b)"], "i12/06-theta-outer-joins.html": ["2024–25 Q5(a)"], "l13/03-access-time.html": ["2019–20 Q1(a)", "2017–18 Q1(d)"], "l13/07-raid-5-parity.html": ["2019–20 Q1(b)", "2019–20 Q1(c)"], "l13/10-beyond-the-slides.html": ["2017–18 Q1(a)"], "l14/02-fixed-length-records.html": ["2020–21 Q1(a)"], "l14/03-deleting-records.html": ["2021–22 Q5(c)"], "l14/05-slotted-page.html": ["2020–21 Q1(b)"], "l14/07-multitable-clustering.html": ["2020–21 Q1(c)"], "l15/02-dense-and-sparse.html": ["2017–18 Q1(b)"], "s01/03-keys-and-superkeys.html": ["2024–25 Q1(a)"], "s01/06-finding-keys.html": ["2024–25 Q1(b)"], "s01/14-third-normal-form.html": ["2023–24 Q1(c)"], "s02/03-conflicts.html": ["2023–24 Q5(a)"], "s02/04-precedence-graphs.html": ["2024–25 Q1(d)", "2022–23 Q1(c)"], "s02/07-two-phase-locking.html": ["2024–25 Q1(c)"], "s03/03-lock-table.html": ["2021–22 Q5(b)"], "s03/08-beyond-the-slides.html": ["2023–24 Q5(b)", "2022–23 Q1(d)"], "s04/03-strict-locking.html": ["2023–24 Q5(b)", "2022–23 Q1(d)"], "s07/07-one-pass-binary.html": ["2017–18 Q1(c)"], "s08/01-nested-loop-joins.html": ["2022–23 Q1(a)"], "s08/02-tpmms.html": ["2024–25 Q5(c)"], "s08/06-choosing-a-join.html": ["2022–23 Q1(b)", "2024–25 Q5(d)"], "s08/07-beyond-the-slides.html": ["2023–24 Q5(d)", "2021–22 Q5(a)", "2023–24 Q5(c)"]};
(function shell() {
  // the book root is wherever assets/book.js lives, so pages work from any sub-folder
  const rootURL = new URL('..', document.currentScript.src).href;
  const here = location.href.split(/[?#]/)[0].slice(rootURL.length);
  const root = rootURL;
  const flat = BOOK.parts.flatMap(p => p.chapters || []);
  const idx = flat.findIndex(c => c[0] === here);

  const toc = () => {
    let h = `<a class="home" href="${root}index.html">DBMS Notes</a>`;
    for (const p of BOOK.parts) {
      if (p.group) { h += `<div class="group">${p.group}</div>`; continue; }
      const open = p.chapters.some(c => c[0] === here);
      h += `<details class="part-d"${open ? ' open' : ''}><summary class="part">${p.title}</summary>`;
      for (const [f, t, s] of p.chapters)
        h += `<a href="${root}${f}"${f === here ? ' class="here" aria-current="page"' : ''}>${t}${BOOK.compulsory?.[f] ? ' <span class="comp-star" title="Has compulsory exam questions (Q1/Q5)">★</span>' : ''} <span class="slides">${s}</span></a>`;
      h += '</details>';
    }
    return h;
  };
  const main = document.querySelector('main');
  if (!main || document.body.dataset.noshell !== undefined) return;
  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = `<nav class="toc" aria-label="Contents">${toc()}</nav><div class="content"></div>`;
  const content = shell.querySelector('.content');
  const m = document.createElement('details');
  m.className = 'mtoc';
  m.innerHTML = `<summary>Contents</summary><nav class="toc" aria-label="Contents">${toc()}</nav>`;
  document.body.prepend(m);
  main.replaceWith(shell);
  content.append(main);

  if (idx >= 0) {
    const prev = flat[idx - 1], next = flat[idx + 1];
    const pg = document.createElement('div');
    pg.className = 'pager';
    pg.innerHTML = (prev ? `<a href="${root}${prev[0]}"><small>← Previous</small>${prev[1]}</a>` : '<span></span>') +
                   (next ? `<a class="next" href="${root}${next[0]}"><small>Next →</small>${next[1]}</a>` : '');
    main.append(pg);
  }
})();

// ---------- figure helpers ----------
const $ = s => document.querySelector(s);

// The instructor relation used throughout the slides (record 0 … record 11).
const INSTR = [
  ['10101', 'Srinivasan', 'Comp. Sci.', '65000'], ['12121', 'Wu', 'Finance', '90000'],
  ['15151', 'Mozart', 'Music', '40000'], ['22222', 'Einstein', 'Physics', '95000'],
  ['32343', 'El Said', 'History', '60000'], ['33456', 'Gold', 'Physics', '87000'],
  ['45565', 'Katz', 'Comp. Sci.', '75000'], ['58583', 'Califieri', 'History', '62000'],
  ['76543', 'Singh', 'Finance', '80000'], ['76766', 'Crick', 'Biology', '72000'],
  ['83821', 'Brandt', 'Comp. Sci.', '92000'], ['98345', 'Kim', 'Elec. Eng.', '80000'],
];

// rows: [{lab, cells (array or null for an empty slot), cls, side}]
function recTable(sel, rows, head = ['ID', 'Name', 'Dept.', 'Salary']) {
  let h = '<table class="rec"><tr><td class="lab"></td>' + head.map(c => `<th>${c}</th>`).join('') + '</tr>';
  for (const r of rows) {
    const cells = r.cells || head.map(() => '');
    h += `<tr class="${r.cls || ''}${r.cells ? '' : ' empty'}"><td class="lab">${r.lab ?? ''}</td>` +
         cells.map(c => `<td${/^\d+$/.test(c) ? ' class="num"' : ''}>${c}</td>`).join('') +
         `<td class="side">${r.side || ''}</td></tr>`;
  }
  if (!sel) return h + '</table>';
  $(sel).innerHTML = h + '</table>';
}
// Plain instructor file: optional per-record class and side note.
function instrRows(cls = {}, side = {}) {
  return INSTR.map((c, i) => ({ lab: `record ${i}`, cells: c, cls: cls[i], side: side[i] }));
}

// Columnar view: one box per attribute. mark = {rowIndex: 'hl' | 'del' | 'dim'}
function columns(sel, mark = {}, heads = ['ID', 'Name', 'Dept.', 'Salary'], rows = INSTR) {
  let h = '<table class="cols"><tr>';
  heads.forEach((hd, c) => {
    h += `<td class="col"><div class="h">${hd}</div>` +
         rows.map((r, i) => `<div class="${mark[i] || ''}">${r[c]}</div>`).join('') + '</td>';
  });
  if (!sel) return h + '</tr></table>';
  $(sel).innerHTML = h + '</tr></table>';
}

// Byte layout strip. cells: [{from, to (exclusive), text, cls}]; ticks: byte numbers to label underneath.
function byteStrip(sel, cells, ticks, { scale = 14, note = '' } = {}) {
  const total = Math.max(...cells.map(c => c.to)), x0 = 50, W = total * scale;
  let s = '';
  for (const c of cells) {
    const x = x0 + c.from * scale, w = (c.to - c.from) * scale;
    s += `<rect class="${c.cls || 'cell'}" x="${x}" y="40" width="${w}" height="34"/>`;
    s += `<text x="${x + w / 2}" y="62" text-anchor="middle" style="font-size:12px">${c.text}</text>`;
    if (c.over) s += `<text x="${x + w / 2}" y="30" text-anchor="middle" class="lbl">${c.over}</text>`;
  }
  s += `<text x="${x0 - 8}" y="94" text-anchor="end" class="lbl">byte</text>`;
  for (const t of ticks) s += `<text x="${x0 + t * scale}" y="94" text-anchor="middle" class="lbl">${t}</text>`;
  if (note) s += `<text x="${x0}" y="14" class="lbl">${note}</text>`;
  const el = $(sel), Wt = x0 + W + 30;
  el.setAttribute('viewBox', `0 0 ${Wt} 104`); el.setAttribute('width', Wt);
  el.innerHTML = s;
}

// Slotted page (slide convention: each header entry stores (size, location) where location is
// the byte just after the record's last byte, i.e. the record occupies [location-size, location)).
// opts: {entries: [[size, loc] | null], freeEnd, records: [{start, end, text, cls}], total}
function slotted(sel, { entries, freeEnd, records, total = 4096, note = '' }) {
  const W = 700, cw = 58, x0 = 10, y0 = 58, hh = 52;
  const hdrCells = 1 + entries.length;
  const hdrW = hdrCells * cw;
  // records drawn right-aligned, width proportional with a floor so small records stay readable
  const sorted = [...records].sort((a, b) => b.end - a.end);
  let xr = x0 + W, pos = {};
  for (const r of sorted) {
    const w = Math.max(64, (r.end - r.start) * 0.28);
    pos[r.end] = xr; pos[r.start] = xr - w; r._x = xr - w; r._w = w; xr -= w;
  }
  const freeX = xr;
  let s = `<rect class="free" x="${x0}" y="${y0}" width="${W}" height="${hh}"/>`;
  // header cells
  const cell = (i, top, bot, cls) => {
    const x = x0 + i * cw;
    return `<rect class="${cls}" x="${x}" y="${y0}" width="${cw}" height="${hh}"/>` +
      `<line x1="${x}" x2="${x + cw}" y1="${y0 + hh / 2}" y2="${y0 + hh / 2}" class="s-fg"/>` +
      `<text x="${x + cw / 2}" y="${y0 + 18}" text-anchor="middle" class="big">${top}</text>` +
      `<text x="${x + cw / 2}" y="${y0 + 44}" text-anchor="middle" style="font-size:12px">${bot}</text>`;
  };
  s += cell(0, entries.length, freeEnd, 'cell-hl');
  entries.forEach((e, i) => { s += cell(i + 1, e ? e[0] : '−', e ? e[1] : 'free', e ? 'cell' : 'cell-plain'); });
  s += `<text x="${x0}" y="${y0 - 24}" class="lbl">BLOCK HEADER</text>`;
  s += `<text x="${x0 + hdrW + (freeX - x0 - hdrW) / 2}" y="${y0 + 32}" text-anchor="middle" class="lbl">free space</text>`;
  s += `<text x="${x0 + W}" y="${y0 - 24}" text-anchor="end" class="lbl">RECORDS (stored from the end of the block)</text>`;
  for (const r of records) {
    s += `<rect class="${r.cls || 'cell'}" x="${r._x}" y="${y0}" width="${r._w}" height="${hh}"/>`;
    s += `<text x="${r._x + r._w / 2}" y="${y0 + 22}" text-anchor="middle" class="big">${r.text}</text>`;
    s += `<text x="${r._x + r._w / 2}" y="${y0 + 40}" text-anchor="middle" class="lbl">${r.end - r.start} B</text>`;
    s += `<text x="${r._x}" y="${y0 - 6}" text-anchor="middle" class="lbl">${r.start}</text>`;
  }
  s += `<text x="${x0 + W}" y="${y0 - 6}" text-anchor="middle" class="lbl">${total}</text>`;
  // arrows: entry i → right edge of its record; header[0] (end of free space) → freeX
  let ay = y0 + hh + 26;
  entries.forEach((e, i) => {
    if (!e) return;
    const sx = x0 + (i + 1) * cw + cw / 2, tx = (pos[e[1]] ?? x0 + W) - 3;
    s += `<path d="M${sx} ${y0 + hh} V${ay} H${tx} V${y0 + hh + 3}" class="s-acc" marker-end="url(#ah)"/>`;
    ay += 10;
  });
  const fx = x0 + cw / 2;
  s += `<path d="M${fx} ${y0 + hh} V${ay} H${freeX} V${y0 + hh + 3}" class="s-red dash" marker-end="url(#ahr)"/>`;
  s += `<text x="${fx + 4}" y="${ay + 14}" class="lbl red">end of free space</text>`;
  if (note) s += `<text x="${x0}" y="14" class="lbl">${note}</text>`;
  const H = ay + 24;
  const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--accent)"/></marker>
    <marker id="ahr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--red)"/></marker></defs>`;
  if (!sel) return `<svg viewBox="0 0 ${W + 30} ${H}" width="${W + 30}">${s}</svg>`;
  const el = $(sel);
  el.setAttribute('viewBox', `0 0 ${W + 30} ${H}`); el.setAttribute('width', W + 30);
  el.innerHTML = defs + s;
}

// ---------- shared arrow markers (one copy per page, referenced by every SVG) ----------
(function markers() {
  const mk = (id, c) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--${c})"/></marker>`;
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<svg width="0" height="0"><defs>${mk('ah', 'accent')}${mk('ahr', 'red')}${mk('m-fg', 'fg')}${mk('m-red', 'red')}${mk('m-acc', 'accent')}${mk('m-grn', 'green')}</defs></svg>`;
  document.body.prepend(d);
})();

// ---------- step-through animation player ----------
// steps: [{html, cap}] (html may be a function). Frames are stacked in one grid cell so the
// figure keeps the height of its tallest frame and frames cross-fade.
function stepper(sel, steps, { interval = 1900 } = {}) {
  const host = typeof sel === 'string' ? $(sel) : sel;
  host.classList.add('stepper');
  host.innerHTML = `<div class="st-stage">${steps.map((s, i) =>
      `<div class="st-frame" data-i="${i}">${typeof s.html === 'function' ? s.html() : s.html}</div>`).join('')}</div>
    <div class="st-cap" aria-live="polite"></div>
    <div class="st-ctl">
      <button type="button" data-a="first" title="Back to the start">⏮</button>
      <button type="button" data-a="prev">◀ Prev</button>
      <span class="st-count"></span>
      <button type="button" data-a="next">Next ▶</button>
      <button type="button" data-a="play">▶ Play</button>
    </div>`;
  const frames = host.querySelectorAll('.st-frame'), cap = host.querySelector('.st-cap'),
        count = host.querySelector('.st-count'), btn = a => host.querySelector(`[data-a="${a}"]`);
  // ?step=N opens every animation on the page at step N (clamped)
  let i = Math.min(steps.length - 1, Math.max(0, (+new URLSearchParams(location.search).get('step') || 1) - 1)), timer = null;
  const show = () => {
    frames.forEach((f, k) => f.classList.toggle('on', k === i));
    cap.innerHTML = steps[i].cap || '';
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    btn('prev').disabled = btn('first').disabled = i === 0;
    btn('next').disabled = i === steps.length - 1;
  };
  const stop = () => { clearInterval(timer); timer = null; btn('play').textContent = '▶ Play'; };
  host.querySelector('.st-ctl').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'play') {
      if (timer) return stop();
      if (i === steps.length - 1) i = 0;
      btn('play').textContent = '⏸ Pause';
      timer = setInterval(() => { if (i < steps.length - 1) { i++; show(); } else stop(); }, interval);
    } else {
      stop();
      if (a === 'next' && i < steps.length - 1) i++;
      if (a === 'prev' && i > 0) i--;
      if (a === 'first') i = 0;
    }
    show();
  });
  host.tabIndex = 0;
  host.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') btn('next').click();
    if (e.key === 'ArrowLeft') btn('prev').click();
  });
  show();
  return host;
}

// ---------- index → file diagrams ----------
// o = { rows, head, colW, rowCls:{i:cls}, blockSize, blockLabels, index:[{key, to:[rows], cls, alignRow}],
//       bucket, outer:[{key, to:entryIdx, cls}], idxBlock, labels:{outer, idx, file}, side:{i:text}, hot:[...] }
function indexSVG(o) {
  const rh = 22, rows = o.rows, colW = o.colW || [52, 88, 82, 52];
  const hasIdx = (o.index && o.index.length) || o.keepIdx;
  const fileW = colW.reduce((a, b) => a + b, 0);
  let x = 10;
  const outerX = x; if (o.outer) x += 76 + 60;
  const idxX = x, idxW = o.idxW || 76; if (hasIdx) x += idxW + (o.bucket ? 46 : 80);
  const bkX = x; if (o.bucket) x += 20 + 70;
  const fileX = x;
  const y0 = 40 + (o.head ? rh : 0);
  const bs = o.blockSize, gap = bs ? 10 : 0;
  const rowY = r => y0 + r * rh + (bs ? Math.floor(r / bs) * gap : 0);
  const ib = o.idxBlock;
  const entY = e => o.index[e].alignRow != null ? rowY(o.index[e].alignRow) : y0 + e * rh + (ib ? Math.floor(e / ib) * 10 : 0);
  let s = '';
  const L = o.labels || {};
  if (L.outer && o.outer) s += `<text x="${outerX}" y="16" class="lbl">${L.outer}</text>`;
  if (hasIdx) s += `<text x="${idxX}" y="16" class="lbl">${L.idx ?? 'index'}</text>`;
  s += `<text x="${fileX}" y="16" class="lbl">${L.file ?? 'instructor file'}</text>`;
  if (o.head) {
    let cx = fileX;
    o.head.forEach((h, c) => { s += `<text x="${cx + 6}" y="${y0 - 7}" class="big" style="font-size:12px">${h}</text>`; cx += colW[c]; });
  }
  // file rows
  rows.forEach((r, i) => {
    const y = rowY(i), cls = (o.rowCls || {})[i] || '';
    let cx = fileX;
    if (!r) {   // free slot
      s += `<rect class="cell-plain" x="${cx}" y="${y}" width="${fileW}" height="${rh}" style="stroke-dasharray:4 3"/><text x="${cx + 6}" y="${y + 15}" class="lbl">(free slot)</text>`;
      return;
    }
    r.forEach((v, c) => {
      const fill = cls === 'hl' ? 'cell-hl' : cls === 'new' ? 'cell-new' : cls === 'del' ? 'cell-del' : cls === 'dim' ? 'cell-dim' : 'cell';
      s += `<rect class="${fill}" x="${cx}" y="${y}" width="${colW[c]}" height="${rh}"/>`;
      s += `<text x="${cx + 6}" y="${y + 15}" style="font-size:12px${cls === 'del' ? ';text-decoration:line-through' : ''}" class="${cls === 'dim' ? 'dimt' : ''}">${v}</text>`;
      cx += colW[c];
    });
    if (o.side && o.side[i]) s += `<text x="${fileX + fileW + 10}" y="${y + 15}" class="lbl" style="fill:var(--red)">${o.side[i]}</text>`;
  });
  if (bs) for (let b = 0; b * bs < rows.length; b++) {
    const y = rowY(b * bs);
    if (o.blockLabels !== false) s += `<text x="${fileX + fileW + (o.side ? 130 : 10)}" y="${y + 15}" class="lbl">block ${b}</text>`;
  }
  // index entries
  (o.index || []).forEach((e, k) => {
    const y = entY(k), hot = e.cls === 'hl' || e.cls === 'hot', fill = e.cls === 'hl' || e.cls === 'hot' ? 'cell-hl' : e.cls === 'new' ? 'cell-new' : e.cls === 'del' ? 'cell-del' : 'cell-plain';
    s += `<rect class="${fill}" x="${idxX}" y="${y}" width="${idxW - 14}" height="${rh}"/><rect class="cell-plain" x="${idxX + idxW - 14}" y="${y}" width="14" height="${rh}"/>`;
    s += `<text x="${idxX + 6}" y="${y + 15}" style="font-size:12px${e.cls === 'del' ? ';text-decoration:line-through' : ''}">${e.key}</text>`;
    const sx = idxX + idxW - 7, sy = y + rh / 2, line = hot ? 's-red' : 's-fg', m = hot ? 'm-red' : 'm-fg';
    if (o.bucket) {
      s += `<rect class="cell-plain" x="${bkX}" y="${y + 2}" width="20" height="${rh - 4}"/>`;
      s += `<path d="M${sx} ${sy} H${bkX - 2}" class="${line}" marker-end="url(#${m})"/>`;
      (e.to || []).forEach(t => { s += `<path d="M${bkX + 20} ${sy} L${fileX - 2} ${rowY(t) + rh / 2}" class="${line}" marker-end="url(#${m})"/>`; });
    } else (e.to || []).forEach(t => { s += `<path d="M${sx} ${sy} L${fileX - 2} ${rowY(t) + rh / 2}" class="${line}" marker-end="url(#${m})"/>`; });
  });
  // outer index
  (o.outer || []).forEach((e, k) => {
    const y = y0 + k * rh, hot = e.cls === 'hl';
    s += `<rect class="${hot ? 'cell-hl' : 'cell-plain'}" x="${outerX}" y="${y}" width="62" height="${rh}"/><rect class="cell-plain" x="${outerX + 62}" y="${y}" width="14" height="${rh}"/>`;
    s += `<text x="${outerX + 6}" y="${y + 15}" style="font-size:12px">${e.key}</text>`;
    s += `<path d="M${outerX + 69} ${y + rh / 2} L${idxX - 2} ${entY(e.to) + rh / 2}" class="${hot ? 's-red' : 's-fg'}" marker-end="url(#${hot ? 'm-red' : 'm-fg'})"/>`;
  });
  const W = fileX + fileW + (o.side ? 140 : 0) + (bs ? 70 : 20);
  const H = Math.max(rowY(rows.length - 1), (o.index || []).length ? entY(o.index.length - 1) : 0) + rh + 16;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${o.aria || 'index and file diagram'}">${o.extra || ''}${s}</svg>`;
}

// ---------- B+ trees ----------
// node: {k: [keys], c: [children]}; a node without c is a leaf. Drawn with n = 4 (3 key slots, 4 pointers).
const BP = { KW: 62, PW: 7, NH: 26, GAP: 12, LV: 96 };
function bpLayout(root) {
  const leaves = [], all = [];
  let id = 0;
  (function walk(n, d, parent) {
    n.id = id++; n.d = d; n.parent = parent; all.push(n);
    if (n.c) n.c.forEach(ch => walk(ch, d + 1, n)); else leaves.push(n);
  })(root, 0, null);
  const NW = 3 * BP.KW + 4 * BP.PW;
  leaves.forEach((l, i) => { l.x = 10 + i * (NW + BP.GAP); });
  (function place(n) { if (n.c) { n.c.forEach(place); n.x = (n.c[0].x + n.c[n.c.length - 1].x) / 2; } })(root);
  all.forEach(n => { n.y = 34 + n.d * BP.LV; });
  return { leaves, all, NW, W: 20 + leaves.length * (NW + BP.GAP), H: 34 + (Math.max(...all.map(n => n.d)) + 1) * BP.LV - 40 };
}
// o = {cur: node, path: Set of ids, cmp: {node, i, cls}, edge: {node, j}, labels: bool}
function bpSVG(root, o = {}) {
  const L = bpLayout(root), { KW, PW, NH } = BP;
  let s = '', e = '';
  const path = o.path || new Set();
  for (const n of L.all) {
    const isCur = o.cur === n, onPath = path.has(n.id);
    if (n.c) n.c.forEach((ch, j) => {
      const sx = n.x + j * (KW + PW) + PW / 2, ex = ch.x + L.NW / 2;
      const hot = o.edge && o.edge.node === n && o.edge.j === j;
      e += `<path d="M${sx} ${n.y + NH} L${ex} ${ch.y - 2}" class="${hot ? 's-red' : 's-fg'}" ${hot ? 'style="stroke-width:3"' : ''} marker-end="url(#${hot ? 'm-red' : 'm-fg'})"/>`;
      if (o.edgeLabels) {
        const r = j === 0 ? `< ${n.k[0]}` : j === n.k.length ? `≥ ${n.k[j - 1]}` : `≥ ${n.k[j - 1]}, < ${n.k[j]}`;
        const lx = sx + (ex - sx) * 0.55, ly = n.y + NH + (ch.y - n.y - NH) * 0.55;
        e += `<text x="${lx + (ex >= sx ? 6 : -6)}" y="${ly}" text-anchor="${ex >= sx ? 'start' : 'end'}" class="lbl" style="fill:var(--accent);font-weight:600">${r}</text>`;
      }
    });
    for (let k = 0; k < 4; k++) {
      const px = n.x + k * (KW + PW);
      s += `<rect class="cell-plain" x="${px}" y="${n.y}" width="${PW}" height="${NH}"/>`;
      if (k < 3) {
        const key = n.k[k] ?? '';
        let cls = isCur ? 'cell-hl' : onPath ? 'cell-path' : 'cell';
        if (o.cmp && o.cmp.node === n && o.cmp.i === k) cls = o.cmp.cls === 'found' ? 'cell-new' : o.cmp.cls === 'miss' ? 'cell-del' : 'cell-cmp';
        s += `<rect class="${cls}" x="${px + PW}" y="${n.y}" width="${KW}" height="${NH}"/>`;
        const fit = key.length * 6.9 > KW - 6 ? ` textLength="${KW - 6}" lengthAdjust="spacingAndGlyphs"` : '';
        s += `<text x="${px + PW + KW / 2}" y="${n.y + 17}" text-anchor="middle" style="font-size:11.5px"${fit}>${key}</text>`;
      }
    }
    if (isCur) s += `<rect x="${n.x - 3}" y="${n.y - 3}" width="${L.NW + 6}" height="${NH + 6}" rx="3" class="s-acc" style="stroke-width:2.5;fill:none"/>`;
    if (o.labels !== false && n.d === 0) s += `<text x="${n.x + L.NW + 10}" y="${n.y + 17}" class="lbl">← root</text>`;
  }
  L.leaves.forEach((l, i) => {
    const nx = L.leaves[i + 1];
    if (nx) e += `<path d="M${l.x + 3 * (KW + PW) + PW / 2} ${l.y + NH / 2} H${nx.x - 2}" class="s-acc" marker-end="url(#m-acc)"/>`;
  });
  const lvl = Math.max(...L.all.map(n => n.d));
  if (o.labels !== false) s += `<text x="10" y="${34 + lvl * BP.LV + NH + 22}" class="lbl">leaf nodes (blue arrows: pointer Pn to the next leaf)</text>`;
  return `<svg viewBox="0 0 ${L.W} ${L.H + 20}" width="${L.W}" role="img" aria-label="B+ tree">${e}${s}</svg>`;
}

// Trace the slides' find(v) algorithm (1-based i, as on slide 32) and return stepper steps.
const BP_CODE = [
  ['1', 'C = root'],
  ['2', 'while (C is not a leaf node)'],
  ['2.1', '    Let i be least number s.t. V ≤ C.Kᵢ'],
  ['2.2', '    if there is no such number i then'],
  ['2.3', '        Set C = last non-null pointer in C'],
  ['2.4', '    else if (V = C.Kᵢ) Set C = C.Pᵢ₊₁'],
  ['2.5', '    else set C = C.Pᵢ'],
  ['3', 'if for some i, Kᵢ = V then return C.Pᵢ'],
  ['4', 'else return null   /* no record with key V */'],
];
function bpFindSteps(root, v) {
  bpLayout(root);
  const lc = x => x.toLowerCase(), steps = [], path = new Set();
  const code = line => `<pre class="code">${BP_CODE.map(([n, t]) =>
      `<span class="${n === line ? 'on' : ''}">${n.padEnd(4)} ${t}</span>`).join('')}</pre>`;
  const name = n => `[${n.k.join(', ')}]`;
  const push = (line, o, cap) => steps.push({ html: `<div class="bp">${bpSVG(root, { ...o, path: new Set(path) })}${code(line)}</div>`, cap });
  let C = root;
  push('1', { cur: C }, `Start at the root. <b>C = ${name(C)}</b>. We are looking for <b>V = "${v}"</b>.`);
  while (C.c) {
    path.add(C.id);
    push('2', { cur: C }, `C = ${name(C)} is not a leaf, so we stay in the loop.`);
    let i = 0;
    for (; i < C.k.length; i++) {
      const yes = lc(v) <= lc(C.k[i]);
      push('2.1', { cur: C, cmp: { node: C, i, cls: 'cmp' } },
        `Is "${v}" ≤ K${i + 1} = "${C.k[i]}"? <b>${yes ? 'Yes' : 'No'}</b>.${yes ? ` So i = ${i + 1}.` : ' Try the next key.'}`);
      if (yes) break;
    }
    let j, line, why;
    if (i === C.k.length) { j = C.c.length - 1; line = '2.3'; why = `No key in this node is ≥ "${v}", so follow the last non-null pointer P${j + 1}.`; }
    else if (lc(v) === lc(C.k[i])) { j = i + 1; line = '2.4'; why = `V equals K${i + 1}. Keys equal to K${i + 1} live in the subtree to its right, so follow P${i + 2}.`; }
    else { j = i; line = '2.5'; why = `V is smaller than K${i + 1}, so follow P${i + 1} (the pointer just left of K${i + 1}).`; }
    push(line, { cur: C, cmp: i < C.k.length ? { node: C, i, cls: 'cmp' } : null, edge: { node: C, j } }, why);
    C = C.c[j];
  }
  path.add(C.id);
  push('2', { cur: C }, `C = ${name(C)} is a leaf, so the while loop ends.`);
  const f = C.k.findIndex(k => lc(k) === lc(v));
  if (f >= 0) {
    const rec = INSTR.find(r => lc(r[1]) === lc(v));
    push('3', { cur: C, cmp: { node: C, i: f, cls: 'found' } },
      `K${f + 1} = "${C.k[f]}" matches. <b>Return C.P${f + 1}</b>, the pointer to the record${rec ? `: <code>(${rec.join(', ')})</code>` : ''}. ` +
      `Nodes read: <b>${path.size}</b>.`);
  } else {
    push('4', { cur: C, cmp: null }, `No key in this leaf equals "${v}". <b>Return null</b>: there is no instructor named "${v}". Nodes read: <b>${path.size}</b>.`);
  }
  return steps;
}
// Interactive tracer: a text box + button that rebuilds the stepper for the typed key.
function bpTracer(sel, root, initial) {
  const host = $(sel);
  host.innerHTML = `<form class="bp-form"><label>Search for name <input type="text" value="${initial}" autocomplete="off" spellcheck="false" id="${host.id}-in"></label> <button type="submit">Trace find(v)</button></form><div class="bp-st"></div>`;
  const run = () => stepper(host.querySelector('.bp-st'), bpFindSteps(root, host.querySelector('input').value.trim() || initial));
  host.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); run(); });
  run();
}


// ---------- learning components ----------
// Multiple-choice self-check with instant feedback and a running score.
// items: [{q, opts: [html...], a: correctIndex, why: html}]
function quiz(sel, items) {
  const host = $(sel);
  host.classList.add('quiz');
  let right = 0, done = 0;
  host.innerHTML = `<div class="qz-score" aria-live="polite">Score: 0 / ${items.length}</div>` + items.map((it, k) =>
    `<div class="qz-item" data-k="${k}"><div class="qz-q"><span class="qz-n">${k + 1}</span>${it.q}</div>
      <div class="qz-opts">${it.opts.map((o, j) => `<button type="button" class="qz-opt" data-j="${j}">${o}</button>`).join('')}</div>
      <div class="qz-why" hidden></div></div>`).join('');
  host.addEventListener('click', e => {
    const b = e.target.closest('.qz-opt'); if (!b) return;
    const item = b.closest('.qz-item'), it = items[+item.dataset.k];
    if (item.dataset.done) return;
    item.dataset.done = 1; done++;
    const ok = +b.dataset.j === it.a; if (ok) right++;
    item.querySelectorAll('.qz-opt').forEach((o, j) => { o.disabled = true; if (j === it.a) o.classList.add('ok'); });
    if (!ok) b.classList.add('bad');
    const why = item.querySelector('.qz-why');
    why.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${it.why || ''}`; why.hidden = false;
    host.querySelector('.qz-score').textContent = `Score: ${right} / ${items.length}${done === items.length ? (right === items.length ? ' · all correct' : ' · review the explanations above') : ''}`;
  });
}

// Type-in answer checker. spec: {q, a: number | string | [strings] | (input)=>bool, tol, why, hint}
function ask(sel, spec) {
  const host = $(sel), id = host.id || ('ask' + Math.random().toString(36).slice(2));
  host.classList.add('ask');
  host.innerHTML = `<div class="ask-q">${spec.q}</div><form class="ask-f"><input type="text" id="${id}-in" autocomplete="off" spellcheck="false" aria-label="Your answer">
    <button type="submit">Check</button>${spec.hint ? '<button type="button" data-h>Hint</button>' : ''}<button type="button" data-s>Show answer</button></form><div class="ask-r" aria-live="polite"></div>`;
  const out = host.querySelector('.ask-r'), norm = x => String(x).toLowerCase().replace(/\s+/g, '').replace(/[{}()\[\]]/g, '');
  const check = v => typeof spec.a === 'function' ? spec.a(v)
    : typeof spec.a === 'number' ? Math.abs(parseFloat(v.replace(/,/g, '')) - spec.a) <= (spec.tol ?? 1e-9)
    : [].concat(spec.a).some(x => norm(x) === norm(v));
  host.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const v = host.querySelector('input').value; if (!v.trim()) return;
    const ok = check(v);
    out.className = 'ask-r ' + (ok ? 'ok' : 'bad');
    out.innerHTML = ok ? `<b>Correct.</b> ${spec.why || ''}` : '<b>Not yet.</b> Try again, use the hint, or show the answer.';
  });
  host.querySelector('[data-s]').addEventListener('click', () => { out.className = 'ask-r show'; out.innerHTML = `<b>Answer:</b> ${spec.show ?? spec.a}. ${spec.why || ''}`; });
  host.querySelector('[data-h]')?.addEventListener('click', () => { out.className = 'ask-r show'; out.innerHTML = `<b>Hint:</b> ${spec.hint}`; });
}

// Flip cards for terms. cards: [{f: front html, b: back html}]
function flashcards(sel, cards) {
  const host = $(sel);
  host.classList.add('cards');
  host.innerHTML = cards.map((c, i) => `<button type="button" class="card" aria-pressed="false"><span class="card-f">${c.f}</span><span class="card-b">${c.b}</span></button>`).join('') +
    '<p class="cards-tip">Click a card to flip it. Try to say the answer before you flip.</p>';
  host.addEventListener('click', e => {
    const c = e.target.closest('.card'); if (!c) return;
    c.classList.toggle('flip'); c.setAttribute('aria-pressed', c.classList.contains('flip'));
  });
}

// Compulsory exam questions: Q1 and Q5 of every term final are compulsory.
// A DB QB source like "24-25 1a" or "22-23 5a, 5b" marks the block.
const compulsoryParts = src => {
  const out = [];
  for (const [, yr, parts] of src.matchAll(/\b(\d\d-\d\d)\s+((?:\d[a-z]?\b(?:\s*,\s*)?)+)/g))
    for (const p of parts.split(/\s*,\s*/)) if (/^[15]/.test(p)) out.push(`20${yr.replace('-', '–')} Q${p[0]}${p[1] ? `(${p[1]})` : ''}`);
  return out;
};
document.querySelectorAll('.exam').forEach(ex => {
  const src = ex.querySelector('.exam-src');
  const parts = compulsoryParts(src?.textContent || '');
  if (!parts.length) return;
  ex.classList.add('comp');
  src.insertAdjacentHTML('beforebegin', `<div class="comp-badge">★ Compulsory · ${parts.join(', ')}</div>`);
});

// AI answer checking: loads only on pages with exam questions (see aicheck.js for how it works without a server).
(function loadAICheck() {
  if (!document.querySelector('.exam')) return;
  const s = document.createElement('script');
  s.src = new URL('aicheck.js', document.currentScript.src).href;
  document.body.append(s);
})();
