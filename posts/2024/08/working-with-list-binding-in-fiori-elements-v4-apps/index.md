---
title: "Working with List Binding in Fiori Elements v4 apps"
date: 2024-08-08
categories:
  - "fiori-ui5"
  - "sap"
tags:
  - "binding"
  - "fev4"
  - "fiorielementsv4"
  - "listbinding"
  - "odata4"
excerpt: There is no "read" method exposed in OData V4 Model unlike in OData V2 Model in UI5. So, how do we read the data then?
---

Recently, I had to work on a requirement to download data from FE v4 list report to a Google Sheet. We had an API that would take the result of a OData GET call and an array of column names and then would save the results into a Google Sheet file. Problem came when we realized that there is no "read" method exposed in [OData V4 model](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v4.ODataModel) object unlike [OData v2 model](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v2.ODataModel) object in UI5.
So, how do we read the data then?

# Problem Statement

Suppose that we have a List Report application to show Purchase Order details with some filter fields. This is a Fiori Elements v4 application. We have applied some filter criteria, say, CompanyCode = 1000 and DocumentType = ZDEMO. This will result in 5000 POs. However, the app does not fetch all the 5000 records. It would fetch only 20 records initially and then as you start scrolling down it would fetch further 20 records and so on.  
Now, let's say, we add a custom action named "Download to Sheets". Within this action, we want to fetch all these 5000 POs (of course, after applying the same filters as above) and then pass them to the Google Sheets API.

So, how do we do this within the action?

# Solution

Solution is to use the [OData v4 ListBinding](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v4.ODataListBinding). There are two ways we can get a list binding object.

- Since we already have a table displayed with the filters applied, the table's list binding would be the best choice - simply obtain this binding and then try to read all the records from that binding
- Or, create a new List Binding object based on the entity set name using OData V4 model's [bindList()](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v4.ODataModel%23methods/bindList) method and apply the filter criteria on it and then the read the data

2nd option is unnecessarily cumbersome. Therefore, we go with the first one. This is how we can do it

## Step 1 - Custom Action and Controller Extension

- Create a custom action using the Fiori Guided Development options

- This would generate a customer controller. Change this to list reprot controller extension by

- registering a controller extension in manifest.json

- using ".extension." prefix on the "press" event of custom action

- Change the controller file name to have ".controller.js" extension - e.g. ListReportExt.controller.js"

- then require "sap/ui/core/mvc/ControllerExtension" in the controller file

- returning ControllerExtension.extend("your.namespace.modulename.ext.extensionfoldername.ListReportExt", {}) from the controller file

Refer to the [Flexible Programming Explorer](https://sapui5.hana.ondemand.com/test-resources/sap/fe/core/fpmExplorer/index.html#/controllerExtensions/guidanceControllerExtensions) for an example of how a controller extension looks like

## Step 2 - Get the correct table object

Within the event handler of custom action, get the table instance using byId()

```js
let oTable = this.getView().byId(
  "your.namespace.modulename::EntitySetList--fe::table::EntityType::LineItem"
);
```

Generated ID might be different. But important thing to note here is that

there are two different table objects when you "inspect element" - one with tag `<table>` and a `<div>` tag which is wrapped around this.  
The one with the `<table>` tag would have its ID ending with `--innerTable`. If you take this object and check its type in the console, you will find that it is an instance of "sap.m.Table".

The one with `<div>` tag would have the same ID but without the suffix `--innerTable`. If you take this object and check its type in the console, you will find that it is an instance of `sap.ui.mdc.Table`.  
We are interested in this one.

> ### How to find the class name?
>
> Do this to find the class name after getting the instance using byId()
>
> ```js
> this.getView().byId("someID").getMetadata().getName();
> ```
>
> You can use this to find the class name of any object within a UI5 application. Simply using the `typeof` operator will return `Object` which is not very useful.

## Step 3 - Working with binding

Once we have the correct table object, all we need to do is to get the row binding

```js
let oListBinding = oTable.getRowBinding();
```

## Step 4 - Request all the data

Since not all data is fetched by Fiori Elements, we will have to trigger GET requests to read further data that is not yet fetched. Since the filters and searches are already obtained on the binding, there is no need to apply them again.  
We need to first decide how many rows we would want to read in a single request. As I noticed, trying to read 5000 rows had some issues - i.e. it did not even trigger the request and there were no errors in the console. Trying to read 1000 records at a time had good performance. I could read about 10,000 records within about 1200ms.

First, calculate number of pages we have

```js
const RECORDS_PER_REQUEST = 1000;
const totalCount = oListBinding.getCount();
const numberOfPages = Math.ceil(totalCount / RECORDS_PER_REQUEST);
let currentPage = 1;
let from = 0;
```

Now, use requestContexts() method of ListBinding to trigger read requests. requestContext() returns a promise which when resolved returns the result of the GET.

### With Grouping

By default, requestContexts() uses the same group as that of the binding. This way, all the GET requests will be triggered as part of one single $batch request.

You would do something like this - (no explicit group ID passed)

```js
let aReadPromise = [];

// collect all promises and wait for them to resolve later
while (currentPage <= numberOfPages) {
  aReadPromise.push(oListBinding.requestContexts(from, RECORDS_PER_REQUEST));
  from += RECORDS_PER_REQUEST;
  currentPage++;
}

Promise.all(aReadPromise).then((aResult) => {
  // aResutl is an array of arrays. Inner arrays contain actual result of each GET request
  let aData = aResult.flat(Infinity).map((oContext) => {
    // do something with the row/context
    return oContext.getObject();
  });
});
```

Since all the GET requests are grouped into 1 $batch, this takes more time to resolve.

### Without Grouping

To send the GET requests parallely i.e. one GET per $batch, pass a unique group id prefixed with "$auto." to requestContexts() method. Documentation here - [requestContexts()](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v4.ODataListBinding%23methods/requestContexts) [Group IDs in OData v4](https://sapui5.hana.ondemand.com/#/api/sap.ui.model.odata.v4.ODataModel)

```js
let aReadPromise = [];

// collect all promises and wait for them to resolve later
while (currentPage <= numberOfPages) {
  // generate a unique group ID using the currentPage e.g. $auto.page_1, $auto.page_2 ...
  aReadPromise.push(
    oListBinding.requestContexts(
      from,
      RECORDS_PER_REQUEST,
      `$auto.page_${currentPage}`
    )
  );
  from += RECORDS_PER_REQUEST;
  currentPage++;
}

Promise.all(aReadPromise).then((aResult) => {
  // aResutl is an array of arrays. Inner arrays contain actual result of each GET request
  let aData = aResult.flat(Infinity).map((oContext) => {
    // do something with the row/context
    return oContext.getObject();
  });
});
```

Now, you will notice that a separate $batch request is triggered with 1 GET request each and are triggered parallelly. So, this completes much quicker than the one with grouping.

## Step 5 - Working with table columns

by Default, this will download all the fields of the entity type. If you want to download only those columns that are currently displayed on the table at the moment, you can do something like this:  
Remember, we are working with [sap.ui.mdc.Table](https://sapui5.hana.ondemand.com/#/api/sap.ui.mdc.Table) and not [sap.m.Table](https://sapui5.hana.ondemand.com/#/api/sap.m.Table)

```js
let aColumns = oTable
  .getColumns()
  .map((oColumn) => oColumn.getProperty("dataProperty"));
```

This returns an array of OData property names (not the column labels) that are currently displayed on the table.  
to get the column labels, you can do

```js
let aColumnLabels = oTable
  .getColumns()
  .map((oColumn) => oColumn.getProperty("header"));
```

Once you have the array of columns, you can filter the data from result as below using `Array.prototype.includes()` method

```js
let aReadPromise = [];
let aColumns = oTable
  .getColumns()
  .map((oColumn) => oColumn.getProperty("dataProperty"));

// collect all promises and wait for them to resolve later
while (currentPage <= numberOfPages) {
  aReadPromise.push(oListBinding.requestContexts(from, RECORDS_PER_REQUEST));
  from += RECORDS_PER_REQUEST;
  currentPage++;
}

Promise.all(aReadPromise).then((aResult) => {
  // aResutl is an array of arrays. Inner arrays contain actual result of each GET request
  let aData = aResult.flat(Infinity).map((oContext) => {
    let oData = {};
    for (const [key, value] of Object.entries(oContext.getObject())) {
      if (aColumns.includes(key)) {
        oData[key] = value;
      }
    }
  });
});
```

After this, aData would contain an array of objects which will have only those attribute as the columns that are currently displayed on the table

That's it!
