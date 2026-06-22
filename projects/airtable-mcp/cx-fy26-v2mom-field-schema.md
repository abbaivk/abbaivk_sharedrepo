# CX FY26 V2MOM - NEW Field Schema

Base: CX FY26 V2MOM - NEW

Tables: 12
Total fields: 282

## CX FY26 H2 Values

Fields: 23

| # | Field | Type |
|---:|---|---|
| 1 | Value | `multilineText` |
| 2 | H2 Values | `multipleSelects` |
| 3 | H2 Value Order | `number` |
| 4 | Methods Top Level | `multipleRecordLinks` |
| 5 | Method Owner | `multipleLookupValues` |
| 6 | Group | `multipleSelects` |
| 7 | Team | `multipleSelects` |
| 8 | Measure Description | `multipleLookupValues` |
| 9 | Obstacles | `multipleRecordLinks` |
| 10 | FY26 Measure (Value) | `multipleLookupValues` |
| 11 | FY26 Q1 Measure (Value) | `multipleLookupValues` |
| 12 | FY26 Q2 Measure (Value) | `multipleLookupValues` |
| 13 | FY26 Q3 Measure (Value) | `multipleLookupValues` |
| 14 | FY26 Q4 Measure (Value) | `multipleLookupValues` |
| 15 | Supporting Methods | `multipleRecordLinks` |
| 16 | Value Order | `number` |
| 17 | Sub-Methods | `multipleLookupValues` |
| 18 | Supporting Method Owner | `multipleLookupValues` |
| 19 | RecordID | `formula` |
| 20 | Records (Nested) | `multipleRecordLinks` |
| 21 | From field: Records (Nested) | `multipleRecordLinks` |
| 22 | H2 Value | `manualSort` |
| 23 | H2 Order | `manualSort` |

## Method Top Level

Fields: 63

| # | Field | Type |
|---:|---|---|
| 1 | Top Level Method | `multilineText` |
| 2 | ELT Metric | `checkbox` |
| 3 | ELT Slide Order | `number` |
| 4 | CLUS Payload Item | `checkbox` |
| 5 | Market Access | `checkbox` |
| 6 | Method Owner | `multipleCollaborators` |
| 7 | Team | `singleSelect` |
| 8 | Status Owner | `multipleCollaborators` |
| 9 | Supporting Methods | `multipleRecordLinks` |
| 10 | Owner - Supporting Method (SM) | `multipleLookupValues` |
| 11 | Team - Supporting Method SM | `multipleLookupValues` |
| 12 | Measure Description | `richText` |
| 13 | Obstacles | `multipleRecordLinks` |
| 14 | FY26 Measure (Value) | `richText` |
| 15 | FY26 Q1 Measure (Value) | `richText` |
| 16 | FY26 Q2 Measure (Value) | `richText` |
| 17 | FY26 Q3 Measure (Value) | `richText` |
| 18 | FY26 Q4 Measure (Value) | `richText` |
| 19 | FY27 Q1 Measure (Value) | `multilineText` |
| 20 | FY27 Q2 Measure (Value) | `multilineText` |
| 21 | TL Update Table | `multipleRecordLinks` |
| 22 | Update Date Numeric | `multipleLookupValues` |
| 23 | Max Date Formula | `formula` |
| 24 | Most Recent Actual | `multipleLookupValues` |
| 25 | Most Recent Status | `multipleLookupValues` |
| 26 | Most Recent Commentary | `multipleLookupValues` |
| 27 | Most Recent Update Date | `multipleLookupValues` |
| 28 | Current Actual | `multipleLookupValues` |
| 29 | Current Status | `multipleLookupValues` |
| 30 | Current Commentary | `multipleLookupValues` |
| 31 | Previous Actual | `multipleLookupValues` |
| 32 | Previous Status | `multipleLookupValues` |
| 33 | Previous Commentary | `multipleLookupValues` |
| 34 | Reporting Period | `multipleLookupValues` |
| 35 | Settings - Global Current Index | `multipleRecordLinks` |
| 36 | Current Reporting Month | `multipleLookupValues` |
| 37 | Status Update Date | `lastModifiedTime` |
| 38 | Status updated by | `lastModifiedBy` |
| 39 | Values | `multipleRecordLinks` |
| 40 | H2 Values (from Values) | `multipleLookupValues` |
| 41 | Form URL TL | `formula` |
| 42 | RecordID | `formula` |
| 43 | Updates | `button` |
| 44 | Feature Firas | `multipleRecordLinks` |
| 45 | CLUS Payload Items (from Feature Firas) | `multipleLookupValues` |
| 46 | Market Access (from Feature Firas) | `multipleLookupValues` |
| 47 | Measure Data Source | `url` |
| 48 | BU Metric | `checkbox` |
| 49 | BU Metric (SM) | `multipleLookupValues` |
| 50 | January Actual | `richText` |
| 51 | January Status | `singleSelect` |
| 52 | January Update | `multilineText` |
| 53 | February Actual | `richText` |
| 54 | February Status | `singleSelect` |
| 55 | February Update | `richText` |
| 56 | Mar 19 Actual | `richText` |
| 57 | Mar 19 Status | `singleSelect` |
| 58 | Mar 19 Update | `richText` |
| 59 | Apr 2 Actual (March MBR) | `richText` |
| 60 | Apr 2 Status (March MBR) | `singleSelect` |
| 61 | Apr 2 Comments (March MBR) | `richText` |
| 62 | Todays Date | `date` |
| 63 | Method Owners Table | `multipleRecordLinks` |

## Supporting Methods

Fields: 62

| # | Field | Type |
|---:|---|---|
| 1 | Sub-Method | `multilineText` |
| 2 | ELT Metric (SM) | `checkbox` |
| 3 | ELT Slide Order | `number` |
| 4 | CLUS Payload Item | `checkbox` |
| 5 | Market Access | `checkbox` |
| 6 | Obstacles | `multipleRecordLinks` |
| 7 | Method Top Level | `multipleRecordLinks` |
| 8 | Owner - Supporting Method | `multipleCollaborators` |
| 9 | Status Owner | `multipleCollaborators` |
| 10 | Team - Supporting Method | `singleSelect` |
| 11 | Measure Description | `richText` |
| 12 | FY26 Measure (Value) | `richText` |
| 13 | FY26 Q1 Measure (Value) | `multilineText` |
| 14 | FY26 Q2 Measure (Value) | `multilineText` |
| 15 | FY26 Q3 Measure (Value) | `multilineText` |
| 16 | FY26 Q4 Measure (Value) | `multilineText` |
| 17 | FY27 Q1 Measure (Value) | `multilineText` |
| 18 | FY27 Q2 Measure (Value) | `multilineText` |
| 19 | SM Update Table | `multipleRecordLinks` |
| 20 | Update Date Numeric | `multipleLookupValues` |
| 21 | Max Date Formula | `formula` |
| 22 | Most Recent Actual | `multipleLookupValues` |
| 23 | Most Recent Status | `multipleLookupValues` |
| 24 | Most Recent Commentary | `multipleLookupValues` |
| 25 | Most Recent Update Date | `multipleLookupValues` |
| 26 | Current Actual | `multipleLookupValues` |
| 27 | Current Status | `multipleLookupValues` |
| 28 | Current Commentary | `multipleLookupValues` |
| 29 | Previous Actual | `multipleLookupValues` |
| 30 | Previous Status | `multipleLookupValues` |
| 31 | Previous Commentary | `multipleLookupValues` |
| 32 | Reporting Period | `multipleLookupValues` |
| 33 | Settings - Global Current Index | `multipleRecordLinks` |
| 34 | Current Reporting Month | `multipleLookupValues` |
| 35 | Status Update Date | `lastModifiedTime` |
| 36 | Status updated by | `lastModifiedBy` |
| 37 | Form URL SM | `formula` |
| 38 | Record ID SM | `formula` |
| 39 | Update SM | `button` |
| 40 | Feature Firas | `multipleRecordLinks` |
| 41 | CLUS Payload Items (from Feature Firas) | `multipleLookupValues` |
| 42 | Market Access (from Feature Firas) | `multipleLookupValues` |
| 43 | Measure Data Source | `url` |
| 44 | BU Metric (SM) | `checkbox` |
| 45 | January Actual SM | `multilineText` |
| 46 | January Status SM | `singleSelect` |
| 47 | January Update SM | `multilineText` |
| 48 | February Actual | `multilineText` |
| 49 | February Status | `singleSelect` |
| 50 | February Update | `multilineText` |
| 51 | Mar 19 Actual | `multilineText` |
| 52 | Mar 19 Status | `singleSelect` |
| 53 | Mar 19 Update | `richText` |
| 54 | Apr 2 Actual (March MBR) | `multilineText` |
| 55 | Apr 2 Status (March MBR) | `singleSelect` |
| 56 | Apr 2 Comments (March MBR) | `multilineText` |
| 57 | Todays Date | `date` |
| 58 | Manual sort | `manualSort` |
| 59 | Record | `multipleRecordLinks` |
| 60 | Records (Nested) | `multipleRecordLinks` |
| 61 | From field: Records (Nested) | `multipleRecordLinks` |
| 62 | Method Owners Table | `multipleRecordLinks` |

## Obstacles

Fields: 7

| # | Field | Type |
|---:|---|---|
| 1 | Obstacle | `multilineText` |
| 2 | Obstacle Owner | `singleCollaborator` |
| 3 | Obstacle Status | `singleSelect` |
| 4 | Obstacle Comments | `multilineText` |
| 5 | Method Top Level | `multipleRecordLinks` |
| 6 | Supporting Methods | `multipleRecordLinks` |
| 7 | Values | `multipleRecordLinks` |

## TL Update Table

Fields: 28

| # | Field | Type |
|---:|---|---|
| 1 | Top Level Method | `multilineText` |
| 2 | NL Record ID | `multilineText` |
| 3 | Obstacles NL | `multilineText` |
| 4 | Method Owner | `singleCollaborator` |
| 5 | Status Owner | `singleCollaborator` |
| 6 | Team NL | `singleSelect` |
| 7 | Jira Link | `url` |
| 8 | Current Actual | `richText` |
| 9 | M2 QTD Actual | `richText` |
| 10 | Current Status | `singleSelect` |
| 11 | Current Commentary | `richText` |
| 12 | Reporting Periods | `multipleRecordLinks` |
| 13 | Reporting Month | `singleLineText` |
| 14 | Update Date and Time | `dateTime` |
| 15 | Update Date Numeric | `formula` |
| 16 | Timestamp Preious Period Only | `formula` |
| 17 | Latest Update Timestamp | `multipleLookupValues` |
| 18 | Is Latest? | `formula` |
| 19 | Current Period Numeric | `formula` |
| 20 | Update Timestamp | `formula` |
| 21 | Reporting Period | `multipleLookupValues` |
| 22 | Reporting Period Order | `multipleLookupValues` |
| 23 | Current Period? | `multipleLookupValues` |
| 24 | Previous Period? | `multipleLookupValues` |
| 25 | Top Level Method Link | `multipleRecordLinks` |
| 26 | Apr 2 Actual (March MBR) | `multilineText` |
| 27 | Apr 2 Status (March MBR) | `singleSelect` |
| 28 | Apr 2 Comments (March MBR) | `multilineText` |

## SM Update Table

Fields: 26

| # | Field | Type |
|---:|---|---|
| 1 | Supporting Method | `multilineText` |
| 2 | Record ID SM Update | `multilineText` |
| 3 | Obstacles | `multilineText` |
| 4 | Supporting Method Owner | `singleCollaborator` |
| 5 | Status Owner | `singleCollaborator` |
| 6 | Supporting Method Team | `singleSelect` |
| 7 | Current Actual | `richText` |
| 8 | M2 QTD Actual | `richText` |
| 9 | Current Status | `singleSelect` |
| 10 | Current Commentary | `richText` |
| 11 | Reporting Periods | `multipleRecordLinks` |
| 12 | Reporting Month | `singleLineText` |
| 13 | Update Date and Time | `dateTime` |
| 14 | Update Date Numeric | `formula` |
| 15 | Latest Update Timestamp | `multipleLookupValues` |
| 16 | Is Latest? | `formula` |
| 17 | Current Period Numeric | `formula` |
| 18 | Update Timestamp | `formula` |
| 19 | Reporting Period | `multipleLookupValues` |
| 20 | Reporting Period Order | `multipleLookupValues` |
| 21 | Current Period? | `multipleLookupValues` |
| 22 | Previous Period? | `multipleLookupValues` |
| 23 | Supporting Methods | `multipleRecordLinks` |
| 24 | Apr 2 Actual (March MBR) | `multilineText` |
| 25 | Apr 2 Status (March MBR) | `singleSelect` |
| 26 | Apr 2 Comments (March MBR) | `multilineText` |

## Method Owners Table

Fields: 10

| # | Field | Type |
|---:|---|---|
| 1 | Name | `singleLineText` |
| 2 | Email Address | `email` |
| 3 | Clean Email | `formula` |
| 4 | Reporting Periods | `multipleRecordLinks` |
| 5 | Is Current Period? (from Reporting Periods) | `multipleLookupValues` |
| 6 | Status Due Date | `multipleLookupValues` |
| 7 | Clean Due Date | `formula` |
| 8 | Last Reminder Sent | `date` |
| 9 | Method Top Level | `multipleRecordLinks` |
| 10 | Supporting Methods | `multipleRecordLinks` |

## Feature Firas

Fields: 22

| # | Field | Type |
|---:|---|---|
| 1 | Feature Name | `multilineText` |
| 2 | Top Method Link | `multipleRecordLinks` |
| 3 | Sub Method Link | `multipleRecordLinks` |
| 4 | CLUS Payload Items | `checkbox` |
| 5 | CLUS Payload Items NEW | `singleSelect` |
| 6 | Market Access | `singleSelect` |
| 7 | Update from Jira? | `checkbox` |
| 8 | FIRA | `singleLineText` |
| 9 | Initial Quarter (Q3 outset) | `singleSelect` |
| 10 | Feb MBER Dates | `singleSelect` |
| 11 | Mar MBER Dates | `singleSelect` |
| 12 | Apr MBER Dates | `singleSelect` |
| 13 | May MBER Dates | `singleSelect` |
| 14 | Latest Release Quarter Status | `singleSelect` |
| 15 | Latest Jira Pull | `date` |
| 16 | JIRA Latest Update Quarter | `singleLineText` |
| 17 | JIRA Status | `singleLineText` |
| 18 | JIRA Executive Status Notes | `multilineText` |
| 19 | JIRA Method | `multilineText` |
| 20 | FY26 Measure (Value) Association | `multilineText` |
| 21 | Method Type | `singleSelect` |
| 22 | JIRA Feature State | `singleSelect` |

## Jira Upload

Fields: 10

| # | Field | Type |
|---:|---|---|
| 1 | Issue Key | `singleLineText` |
| 2 | JIRA Pull Date | `date` |
| 3 | General Availability Date | `date` |
| 4 | General Availability Fiscal Quarter | `singleSelect` |
| 5 | Desired Release Quarter | `multipleSelects` |
| 6 | Latest Update Quarter | `formula` |
| 7 | Feature State | `singleSelect` |
| 8 | Status | `singleLineText` |
| 9 | Executive Status Notes | `multilineText` |
| 10 | JIRA Method | `multilineText` |

## Summary of Updates

Fields: 4

| # | Field | Type |
|---:|---|---|
| 1 | Status Used | `singleLineText` |
| 2 | AI Generated Summary | `richText` |
| 3 | Reporting Periods | `multipleRecordLinks` |
| 4 | Status End Date | `multipleLookupValues` |

## Reporting Periods

Fields: 20

| # | Field | Type |
|---:|---|---|
| 1 | Reporting Periods | `singleLineText` |
| 2 | Start Date | `date` |
| 3 | Start Timestamp | `formula` |
| 4 | End Date | `date` |
| 5 | Status Due Date | `date` |
| 6 | Reporting Month | `singleSelect` |
| 7 | Applied to Method Owners | `checkbox` |
| 8 | End Timestamp | `formula` |
| 9 | Is Current Period? | `formula` |
| 10 | Is Previous Period? | `formula` |
| 11 | Period Index | `number` |
| 12 | Current Period Index Helper | `formula` |
| 13 | Settings - Global Current Index | `multipleRecordLinks` |
| 14 | Active Index | `multipleLookupValues` |
| 15 | Top Level Method Updates | `multipleRecordLinks` |
| 16 | Submethod Updates | `multipleRecordLinks` |
| 17 | Reporting Period Order | `number` |
| 18 | Method Top Level | `singleLineText` |
| 19 | Method Owners Table | `multipleRecordLinks` |
| 20 | Summary of Updates | `multipleRecordLinks` |

## Settings - Global Current Index

Fields: 7

| # | Field | Type |
|---:|---|---|
| 1 | Global Current Index | `singleLineText` |
| 2 | Reporting Periods | `multipleRecordLinks` |
| 3 | Active Index | `rollup` |
| 4 | Current Reporting Month | `rollup` |
| 5 | Method Top Level | `singleLineText` |
| 6 | Method Top Level 2 | `multipleRecordLinks` |
| 7 | Supporting Methods | `multipleRecordLinks` |
