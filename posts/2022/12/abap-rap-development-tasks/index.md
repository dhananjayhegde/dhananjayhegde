---
title: "ABAP RAP - Development Tasks"
date: "2022-12-18"
categories:
  - "abap"
  - "sap"
tags:
  - "abap"
  - "restful-application-programming"
  - "sap"
coverImage: "images/DALLE2-Developer.png"
excerpt: High level overview of some basic yet important tasks of a RAP application developer considering different use cases such as developing Fiori Elements applications, OData Web APIs and PaaS APIs for S/4 HANA Public Cloud
---

If you are asked to develop ABAP RAP (RESTful Application Programming model) Business Object based app or API, then you should know what it involves on a high level. I try to sumarize that here. This is by no means an exhaustive list.

## RAP Core BO (RAP Facade)

- Create DB Tables (for active persistence)

- Develop Transactional Processing CDS view entities for these that make up the composition tree (parent - child relationship)

- Create Transactional Processing Behaviour Definition (BDEF)

  - Type of implementation (managed / unmanaged)

  - Implementation class

  - Draft supported or not

  - Draft DB tables for each entity

  - Define operations (CUD) and actions

  - Define determination and validations (only for draft enabled BOs - both managed and unmanaged)

  - Implement actions, determinations and validations

  - Define numbering (early / late, managed or unmanaged)

    - If unmanaged, then implement the logic to derive numbers

  - Define authorization (instance and global)

    - Implement the auth check logic

  - Define locking (managed / unmanaged)

    - Implement locking if unmanaged BO or managed BO with unmanaged or additional save

  - Define field control (static and/or dynamic)

    - Implement logic for dynamic field control

  - If unmanaged BO, then implement CRUD operations in BIL

  - If unmanaged or additional save, then implement “save” sequence methods

    - Methods available in “save” handler local class depends on

      - the type of BO (managed / unmanaged)

      - type save (managed, unmanaged, additional)

      - numbering (early / late)

## Projection Layer based on use case

- Projection for UI consumption:

  - Create CDS projection views, add **UI annotations**

    - Create UI facets, field groups etc.

    - Add value helps, text elements etc.

  - Create **projection BDEF**, expose entities, **draft capability**, operations (CUD), actions that are required from RAP facade

  - Implement any augmentation if required in projection BIL

  - Generate Service definition and service binding

- Projection for Web API consumption:

  - Create CDS projection views

    - Adding value helps should not be required

  - Create **projection BDEF**, expose entities, operations (CUD), actions that are required from RAP facade

  - Implement any augmentation if required in projection BIL

  - Generate Service definition and service binding

- Projection for PAAS API:

  - Create CDS projection views

    - Adding value helps should not be required

  - Create **interface BDEF**, expose entities, operations (CUD), actions that are required from RAP facade

  - Implement any augmentation if required in projection BIL

## Unit Tests and End to ENd Tests

Writing test autoamates for different artifacts

- A Units for ABAP Implementation

  - either by mocking DB tables for draft and active instances using OSQL Test Environment class or mocking CDS views using CDS Test Environment class

  - or by mocking EML statements using IF_ABAP_BEHV_TESTDOUBLE

- End ot end tests for ABAP Implementation of

  - Draft Behavior i.e. Determinations, validations

  - Active instance in case of "Unmanaged" BO

- Test automation for ODATA service

  - Can be done using Client Proxy class

- A Units for CDS views
  - The y are tested usually if they contain any complex logic / calculations
