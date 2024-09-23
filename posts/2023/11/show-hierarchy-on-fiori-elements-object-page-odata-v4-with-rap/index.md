---
title: "Show hierarchy on Fiori Elements Object Page - OData V4 with RAP"
date: "2023-11-21"
series: Hierarchy with RAP and OData 4
categories:
  - "abap"
  - "sap"
tags:
  - "abap"
  - "hierarchy"
  - "restful-application-programming"
coverImage: "image-4.png"
excerpt: How to use hierarchy capabilities offered by OData v4 and RAP to show a hierarchical table on Fiori Elements object page?  Read further to know...
---

Previous 2 posts in this series dealt with showing hierarchy on a List Report page of a Fiori Elemetns application using Hierarchy capabilities of OData V4 with CDS Hierarchy. In this post, let's see how to show it on an Object Page.

All these objects are created and tested on BTP Trial account as of today when this post was first published i.e. on November 21, 2023. All ABAP source code used here are available in this [Git Repo](https://github.com/dhananjayhegde/abap-rap-samples-new). Feel free to clone it using [abapGit](https://abapgit.org/) and use it for testing. All the objects created for this specific post are available in package **ZDH_V4_HIER_OP**.

## Use Case

Suppose we have `Order` which can have one or more `Items`. An item may have a parent item. One parent item may have one or more child items. i.e. an item hierarchy. There is no restriction on how deep the hierarchy can go. We want to show this as a Tree Table (hierarchy) on the obejct page of `Order`. This means, every time an object of an order is displayed, only those items which belong to that specific order should be shown. Also, while creating the hierarchy, items should be filtered based on the order number. This significantly reduces the processing required to construct a hierarchy. Because, we do not epxect an order to contain more than few hundred items or, may be, in rare cases, a couple of thousand items.

## Data Model

We use a similar data model that we used in previous post. But, since I do not want to disturb the example objects created for that, I will recreate all objects that are required for this post in a different package - **ZDH_V4_HIER_OP**. For the purpose of brevitiy, I will not post source code of those CDS views here. You can find them and also clone them from the repo mentioned above. But, I will highlight important differences from the previous post, nevertheless. That's the whole point of this post.

In the end, the data model looks like this:

![Item-hierarchy_op-1024x638.png](/static/img/2023/11/Item-hierarchy_op-1024x638.png)

Notice these changes -

We created a different CDS view for hierarchy node `ZDH_I_OrderItemNode_2` which has 2 associations now - one for hierarchy `directory` filtering `_OrderHeader` (which we will discuss later) and other for the parent-child relationship of item hierarchy `_Parent`. Both these associations are promptly exposed from the CDS view.

```abap
@AbapCatalog.viewEnhancementCategory: [#NONE]
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'Hierarchy Node For Order Item'
@Metadata.ignorePropagatedAnnotations: true
...

define view entity ZDH_I_OrderItemNode_2
  as select from ZDH_I_OrderItemBasic

  // Directory Association
  association [1..1] to ZDH_I_OrderBasic      as _OrderHeader on  _OrderHeader.OrderId = $projection.OrderId

  // Hierarchy Association
  association        to ZDH_I_OrderItemNode_2 as _Parent      on  $projection.OrderId      = _Parent.OrderId
                                                              and $projection.ParentItemNo = _Parent.ItemNo
{
  key OrderId,
  key ItemNo,
      ParentItemNo,
      ...

      _OrderHeader,
      _Parent
}
```

CDS hierarchy `ZDH_I_OrderItemHierarchyDir` has a `directory` filter now using the association created above - `_OrderHeader`. Notice that it also has a parameter `p_order_id` which is used as filter criteria. Aall fields that are used for the `on` condition of `_OrderHeader` in the source CDS view should also be used in `filter by` condition of hierarchy directory!

```abap
@EndUserText.label: 'Order Item Hierarchy'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define hierarchy ZDH_I_OrderItemHierarchyDir
  with parameters
    p_order_id : ebeln
  as parent child hierarchy(
    source ZDH_I_OrderItemNode_2
    child to parent association _Parent
    directory _OrderHeader filter by
      OrderId = $parameters.p_order_id
    start where
      ParentItemNo is initial
    siblings order by
      ItemNo
    multiple parents not allowed
  )
{
  key OrderId,
  key ItemNo,
      ParentItemNo
}
```

Then, we create remainng RAP transactional processing and projection CDS views for Order Header and Order Item where Order Header is the root entity viz. `ZDH_R_OrderHeaderDirTP`, `ZDH_R_OrderItemDirTP`, `ZDH_C_OrderHeaderDirTP`, `ZDH_C_OrderItemDirTP`.

Create RAP BDEF for these in case you want to add actions to Order Item entity. But note that, as of now when this post was first written, it is not possible to add draft behavior or create, update, delete capabilities to Order Item which has hierarchy.

Link the CDS hierarchy we created earlier to projection CDS view entity `ZDH_C_OrderItemDirTP` using annotation `@OData.hierarchy.recursiveHierarchy`:

```abap
@EndUserText.label: 'Order Item Projection'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Search.searchable: true

@OData.hierarchy.recursiveHierarchy: [{entity.name: 'ZDH_I_OrderItemHierarchyDir'}]
define view entity ZDH_C_OrderItemDirTP
  as projection on ZDH_R_OrderItemDirTP
{

      @UI.selectionField: [{ position: 10 }]
  key OrderId,

  @UI.lineItem: [
        { position: 10, label: 'Item No' },
        { type: #FOR_ACTION, dataAction: 'SetToComplete', position: 10, label: 'Complete', invocationGrouping: #CHANGE_SET }
      ]
  key ItemNo,

      ...

      /* Associations */
      _Header : redirected to parent ZDH_C_OrderHeaderDirTP,
      _Parent : redirected to ZDH_C_OrderItemDirTP
}
```

Add required annotations to show some columns on list report and also to show some facets, especially, line item reference facet on header's object page. Refer to GitHub repo to see how `#LINEITEM_REFERENCE` is added pointing to association `_Item` in `ZDH_C_OrderHeaderDirTP`.

Unlike before, this time we expose both `OrderHeader` and `OrderItem` entities in Service Definition `ZDH_SD_ORDERITEM_HIER_OP` but not the CDS hierarchy iteself. Create a service binding with binding type "OData V4 - UI" and publish it. To my suprise, for some reason, in this case, "preview" from here does not show the item hierarchy out of the box like it did for list report page. So, to test it, we have to generate an app and make some changes to `manifest.json`.

```abap
@EndUserText.label: 'Service Definition for Order with Hier on OP'
define service ZDH_SD_ORDERITEM_HIER_OP {
  expose ZDH_C_OrderHeaderDirTP as OrderHeader;
  expose ZDH_C_OrderItemDirTP   as OrderItem;
}
```

## Changes in Fiori Elements app

Head over to BAS (Business Application Studio) and generate a Fiori Elements List Report application. Choose `OrderHeader` as main entity and `OrderItem` as navigation entity. Once generated, find the file `manifest.json`. If you followd the same naming convetion for entities that are exposed, then you will find an object named `OrderHeaderObjectPage` in this file under `sp.ui5 -> routing -> targets`. Add `controlConfiguration` to the `settings` object of this. It should look like this:

```json
       "OrderHeaderObjectPage": {
          "type": "Component",
          "id": "OrderHeaderObjectPage",
          "name": "sap.fe.templates.ObjectPage",
          "options": {
            "settings": {
              "controlConfiguration": {
                "_Item/@com.sap.vocabularies.UI.v1.LineItem": {
                  "tableSettings": {
                    "type": "TreeTable",
                    "hierarchyQualifier": "ZDH_I_OrderItemHierarchyDir",
                    "selectionMode":"Multi"
                  }
                }
              },
              ...
            }
          }
        },
```

Note that how a specific table is targetted by using the association name from `OrderHeader` to `OrderItem` i.e. `**_Item**/@com.sap.vocabularies.UI.v1.LineItem`. This is because, an object page may contain more than one 'Line Item Reference\` facets. For example, an Order may contain multiple partners, multiple contact persons and so on. So, we need to specify exactly which table/Line Item Reference facet whose settings we want to change.

Other notable changes are

- we have changed the table type to Tree Table (default is Responsive Table)

- we have targetted the CDS hierarchy `ZDH_I_OrderItemHierarchyDir` using property `hierarchyQualifier`

## Test Data

I generated some orders with items/item hierarchies using this class (which was also used earlier but now adjusted to fill order header table with corresponding order numbers) - `ZDH_HIERARCHY_FILL_DATA`. You may run this class in ADT or use somthing similar to generated test data, if some are already not there.

With this, if you run the Fiori app now, you should see the hierarchy as shown below on the obejct page of an order:

![image-3-1024x527.png](/static/img/2023/11/image-3-1024x527.png)

Expanded items would look like this:

![image-4-1024x567.png](/static/img/2023/11/image-4-1024x567.png)

Having worked with hierarchies on both OData V2 and OData V4, I can vouch that this is a great feat in terms of reducing development time required to develop such applications when it comes to OData V4. Also, there is a great deal of boiler plate code that was required in case of OData V2 developments - one had to create a CDS view with custom query implementation and write a lot of ABAP code in it to make things work. In OData V4, CDS Hierarchy is used internally without the need of any additional ABAP coding so that we can focus on `real business logic`, as they always say!

More power to ABAPers, more power to you!

Cheers!
