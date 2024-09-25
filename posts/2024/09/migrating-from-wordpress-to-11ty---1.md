---
title: Migrating from WordPress to 11ty - 1
date: 2024-09-24
categories:
  - wordpress
  - 11ty
tags:
  - wordpress
  - 11ty
  - static-site
---

After 2 years of running my personal blog on WordPress, I made the move to [11ty](https://11ty.dev), a blazing fast, static site generator. I instantly fell in love with its simplicity!

---

# Why the migration?

In 2022, very simple blog site for myself with WordPress. I wanted to spend as little time in developing this site than writing blogs. Since I was familiar with WordPress, I went with it. Purchased a shared Linux hosting on Bluehost which costs about INR 3500 per year.

There was a few reasons that slowly pushed me away from WordPress:

- Cost of hosting became a bit too much as my writing was not as much I liked it to be
- I felt I could not get the site loading faster without paying for any plugins
- There were so many features probably I did not anyway (bloated up)
- Wanted to keep my content separate, with me (no vendor/technology lock-in) - something like managing with just markdowns

I needed something cheaper, simpler to manage, loads faster. What better than a static site generators?

# How did I choose 11ty

To be frank, I got this idea from [DJ Adam's blog](https://qmacro.org/). I have been following his blog for various topics and liked it simplicity. So, I got curious and looked around. Thankfully, he has added a footer note that it was developed with 11ty. I poked around a little bit and it looked easy to set up and get started. Has a few important features like "posts", "tags" etc. out of the box. I had used Next.js before but found it over-engineered for my current requirement.

There are in fact [many of them](https://jamstack.org/generators/) to choose from. I am familiar with Jekyll and had tried to use Gatsby briefly. But, I found the simplicity of 11ty very attractive.

# The non-negotiables

There were a couple of features I wanted which required me to write some custom code in WordPress. Example, grouping posts on "Series". A series of how-tos or similar posts that may fall under a broad category but should be grouped under specific sequence of posts. For example, there may be many posts under category "SAP" or "ABAP", but a specific set of posts may be grouped under a series named "How to work with hierarchies in ABAP and OData v4".

I solved this by creating a custom taxonomy named "Series" and a template for this taxonomy where all Series will be shown along with their respective posts under them. Also, on the Blog page, if a post is a part of a series, then it would be tagged as such:

![Pasted image 20240924074523.png](/static/img/2024/09/pasted-image-20240924074523.png)

So, the site generator must offer me this feature without having to write a tons of line of code. [11ty Collections](https://www.11ty.dev/docs/collections/) were the best suited for this!

# Migration

## Step 1 - Feasibility Study

First step is to get all my content - posts and pages - from Wordpress and convert them into markdown files such that 11ty could use them to generate the site. Smashing Magazine simply seem to have a post for almost anything you need - [How to migrate from Wordpress to 11ty](https://www.smashingmagazine.com/2020/12/wordpress-eleventy-static-site-generator/#:~:text=It's%20the%20same%20process%20that,website%2C%20ready%20for%20static%20serving.).

The above post only talks about migrating pages. But it was not difficult to follow it to get posts too. Luckily the package [wordpress-posts-to-markdown](https://github.com/lonekorean/wordpress-export-to-markdown) also pulls all the media files and saves them to your local machine.

I used these markdown files to build a couple of demo sites locally. This post from [11ty Rocks](https://11ty.rocks/posts/creating-and-using-11ty-collections/#collections-from-tags) and the posts from [Matt McAdams](https://www.mattmcadams.com/posts/tags/11ty/) site helped me a lot to understand how to work with Collections. In fact, Matt McAdams' site inspired me a lot and I followed his ideas to develop my site too. His site was proof enough for me to know I could achieve what I wanted to with 11ty.

## Step 2 - Get the content

11ty needs the content in Markdown files. But, WordPress exported them into XML. So, I needed to convert all the posts and pages into Markdown and also organize the images such that it is easier for 11ty to generate the site.

In summary this is what I did:

- From WordPress admin, exported all posts, pages, custom post types, taxonomies. This gave me an XML file
- Then, on my local machine, cloned the GitHub repo [wordpress-posts-to-markdown](https://github.com/lonekorean/wordpress-export-to-markdown). This is a Nodejs package
- Copied the XML file to root folder of this package and renamed it to "export.xml" (this is not necessary, but for convenience)
- Ran the package. It asked a few questions about what to download, how to name and organize the converted markdown files etc. Experimented with it a little. In the end, this is what I ended up with:
  - Posts are grouped under sub directories year/month/
  - each post has its own subdirectory with the post slug as its name
  - under that directory, there is a index.md which has the post content
  - this also has a subdirectory named "images" which has all the images including the "featured image" used on the post
  - It looks like this

![Pasted image 20240924083100.png](/static/img/2024/09/pasted-image-20240924083100.png)

## Step 3 - Move content to 11ty

This is simple enough - copy the contents of "post" directory of wordpress-posts-to-markdown package to "posts" directory of 11ty. That's it!

No, that is not it!

## Step 4 - Challenges

Once you copy the contents of "post" directory to 11ty, build and serve the site, you will notice that your site does not have a few things -

- custom taxonomies are missing in the markdown file's front-matter - in my case, the "Series" taxonomy was not added. Only the "categories" and "tags" were added
- 11ty automatically does not understand "categories". Though it understands "tags" we need to develop templates to show posts by tag
- Images did not show up on the site. Upon closer inspection, images were not even copied to the generated "\_**_site_**" directory. We will talk about this later

## Step 5 - Starter Site

I found it easier to get started with a start site than from scratch. I used this minimal [boilerplate starter site](https://eleventy-netlify-boilerplate.netlify.app/) which was sufficient for my purpose. I deployed it to Netlify, cloned the repo to local machine, copied the contents of "post" directory to "posts" directory of this new site and the site was up - locally!

## Step 6 - Adding features

### Collections

First step was to add a few collections that I would need

- Posts by "Series"
- Posts by "tag"
- Posts by "Category"
- Posts by "Year"

Tag, category and series are added as front-matter whereas "year" collection is automatically generated based on the "date" of each post. Post date itself could be added as a front-matter but if not added, 11ty takes the file's creation date as the date of the post.

It is not necessary that each collection should have a collection template where all the terms in that collection would be listed. A single-collection template would be sufficient.

For example, it did not make sense to have a page where all tags or all categories would be listed. It was sufficient to have a template where all posts belonging to a tag or a single category would be listed.

i.e. nothing comes up or a 404 page comes up when I go to http://localhost:8080/categories/ or http://localhost:8080/category (this is a page where we would have expected to see all available categories). However, all posts in the category "SAP" will show up when I go to http://localhost:8080/category/sap/ (this is a single category page).

A "Series" front-matter attribute may have only 1 value where as there may be many tags or categories for a given post.

![Pasted image 20240924093028.png](/static/img/2024/09/pasted-image-20240924093028.png)

### Number of posts by category/year

Further, I also wanted to show number of posts per category on the sidebar and an archive of posts by year with number of posts. For these, I added below collections

- categoryList
- postYearList

Sample coding looks like this. You can find the complete coding here in the [GitHub repo](https://github.com/dhananjayhegde/dhananjayhegde) in `.eleventy.js` file

```js
// Category list and count of posts
  eleventyConfig.addCollection("categoryList", (collection) => {
    const tagsObject = {};
    collection.getFilteredByTags("post").forEach((item) => {
      if (!item.data.categories) return;
      item.data.categories.forEach((cat) => {
        if (typeof tagsObject[cat] === "undefined") {
          tagsObject[cat] = {
            count: 1,
            posts: [],
          };
        } else {
          tagsObject[cat].count += 1;
        }
        tagsObject[cat].posts.push(item);
      });
    });

    const tagList = [];
    Object.keys(tagsObject).forEach((tag) => {
      tagList.push({
        name: tag,
        postCount: tagsObject[tag].count,
        posts: tagsObject[tag].posts,
      });
    });
```

Later, this collection can be used in any template file to render the category list, number of posts per category, a link to single category page etc. For example, a list with these details may be rendered like this:
{% raw %}

```liquid
<ul class="category-filter">
    {% for cat in collections.categoryList %}
        <li>
            <a href="/category/{{ cat.name }}">{{ cat.name }}</a>
            <span class="post-count">({{ cat.postCount }})</span>
        </li>
    {% endfor %}
</ul>
```

{% endraw %}

### Series taxonomy

However, for "Series", I wanted to have a singe page to list all the "series" and all the respective posts under them. Series collection looks like this from `.eleventy.js`

```js
eleventyConfig.addCollection("series", (collection) => {
  const blogs = collection.getFilteredByTags("post");
  const seriesColl = blogs.reduce((coll, post) => {
    const series = post.data.series;
    if (!series) {
      return coll;
    }
    if (!coll.hasOwnProperty(series)) {
      coll[series] = [];
    }
    coll[series].push(post.data);
    return coll;
  }, {});
  return seriesColl;
});
```

And the template to render all the series data looks like this:

{% raw %}

```liquid
---

layout: layouts/base.njk
title: "Series"
date: 2023-09-17
permalink: /series/index.html
eleventyNavigation:
  key: Series
  order: 3
pagination:
  data: collections.series
  size: Infinity

---

<h1>Tech Series</h1>
<p>
  Collection of posts grouped into a series so that it's earier to follow along. Some are how-tos and some others may be are my thoughts on experiementing with some stuffs.
</p>
<section class="layout__compact">
  {% for item in pagination.items %}
    <h3>
      <a href="/series/{{ item | slug }}">{{ item | safe }}
      </a>
    </h3>
    <ol class="layout__condense">
      {% for post in collections.series[item] %}
        <li>
          <a href="{{ post.page.url | url }}">{{ post.title }}</a>
        </li>
      {% endfor %}
    </ol>
  {% endfor %}
</section>
{% include "components/social-share.njk" %}
```

{% endraw %}
Added `eleventyNavigation` so that link to this page also appears on the main navigation of the site.

Getting these done gave me the confidence that I could move away from WordPress to 11ty. But there were still a couple of hurdles -

- getting images to work
- Setting up a workflow to write so that I don't have to work with plain markdowns struggling to remember all the syntaxes - using something like Obsidan to write and then move the markdown files and all related images to 11ty directories, push the post to GitHub so that it can get deployed to Netlify or wherever else it should

I will write about these in the next post!
