---
title: "UI5 WebComponents with React #1 - Class constructor Input cannot be invoked without 'new'"
date: "2023-04-07"
categories:
  - "fiori-ui5"
  - "react-js-next-js"
  - "sap"
tags:
  - "react"
  - "sap"
  - "ui5"
excerpt: I got this error while experimenting with UI5 Web Components with React.  Took me about a day to figure out what the error meant and where I had messed up.  Hope this helps you if you too are stuck with same issue.
---

Out of the blue, I got interest in trying out UI5 Web Components with React today. Then I rememebered that I had completed [this excellent tutorial](https://developers.sap.com/tutorials/ui5-webcomponents-react-introduction.html) during DevtoberFest 2022.

So, I used this template to bootstrap a basic React app with UI5 Web Component.

```kbd
npx create-react-app my-app --template @ui5/cra-template-webcomponents-react
cd my-app
```

My goal was to follo the age-old tradition (my own) of building a Todo app with this. So, I created a /components directory under /src and created 3 custom components.

Todo, TodoList, TodoListItem

Then I added Todo component to my main App.js

At this moment, my Todo component looked something like this:

```js
import Input from "@ui5/webcomponents/dist/Input";
import React, { useState } from "react";

const Todo = (props) => {
  const [inputVal, setInputVal] = useState("");

  const handleInput = (e) => {
    setInputVal(e.target.value);
  };

  return (
    <div slot={props.slot}>
      <Input
        placeholder="What do you want to get done?"
        value={inputVal}
        onChange={handleInput}
      />
    </div>
  );
};

export default Todo;
```

That's when I started getting the nasty error

"**Class constructor Input cannot be invoked without 'new' TypeError: Class constructor Input cannot be invoked without 'new'**"

![image-2.png](/static/img/2023/04/image-2.png)

## Root Cause

Generally, if you want to use UI5 Web Components with React, (that's what many tutorials, sample applications show you), you would normally import all the components from `@ui5/webcomponents/dist/` and then use them like `<ui5-input>...</ui5-input>`.

However, if you used the template like I did which uses the package `@ui5/webcomponents-react`, then you have two different ways of importing and using UI5 Web Components.

1. By importing them from `@ui5/webcomponents/dist/` and then using the tags like I mentioned above OR

2. By importing them from `@ui5/webcomponents-react` and then using them like you would use any custom React component e.g. `<Input />`

In my case, when I used the code completion to import the `Input` component, it was imported from `@ui5/webcomponents/dist/` but I was using the component as though it was imported from `@ui5/webcomponents-react`!

This was causing the problem. Unfortunately, no one ever seem to have faced this error so far!!!

So, when you import UI5 WebComponents, be aware of the mischiefs code completion plays on you -

![image-1.png](/static/img/2023/04/image-1.png)

In caseyou are ever stuck with this error, hope you find this page and it will save you your precious time.

Cheers!
