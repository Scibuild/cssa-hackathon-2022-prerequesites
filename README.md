# Programs and Courses Prerequisites

This project contains a few components that work on programs and courses data. It was written as part
of the 2022 CSSA Hackathon event that took place from 30th July to 2nd of August. Here is some documentation
I wrote after submitting with two minutes to spare.

## Running this code

The python file depends on a few python packages that can be installed via `pip`, namely `asyncio`, `requests`,
`aiohttp` and `beautifulsoup4`. The websites require no dependencies apart from a browser. Simply run a
localhost server, or even easier, open the `html` file straight in the browser.

# Downloading and scraping

Downloading and scraping of ANU's Programs and Courses is done with `async` python in `read-requisites.py`. 
It first searches all the available courses and then concurrently requests each course page. It then 
stores the semester each course is available in and the text in the Requisite and Incompatibility section,
writing this all to disk as `json` once it is complete.

# Entering Prerequisites

The core of the project is this interface that presents a user with some programs and courses text and
asks them to describe what the course requires in terms of a unique logical language. In total there are
over 2000 courses that require description, but this can be solved by distributed human labour, allocating
about 100 courses to less than 30 people could have all the courses labelled within a few hours (after
teaching them the syntax of course). Speaking of which, the language has the following syntax with
parentheses for grouping:

* `A | B` to express logical OR
* `A & B` to express logical AND
  * OR and AND have incompatible precedence to avoid errors from entering `A | B & C` when `(A | B) & C` was intended.
* `!A` to express course incompatibility
* `~A` to express corequisite requirements
* `EXPL1001 > num` to express mark requirements
* `A * num` to express that a requirement must be satisified multiple times
* `_` to express any course
* `EXPL1_` to express any course that starts with `EXPL1`
* `EXPL1001` to express exactly the course code `EXPL1001`

Potential future syntax could include a symbol to indicate that a permission code is required or the course is
only available to a particular degree (without necessarily mentioning which in code).

For easy of entry, all course codes that appear in the PnC description are clickable links that paste the course
code at the end of the text entry. Keyboard events are used to ensure this does not remove browser focus from
text entry.

This syntax is all parsed on the browser and saved in local storage as a big object. Courses with blank
descriptions are automatically skipped and given a `NONE` requirement in this object. The object can be
serialised to and from JSON using the button and file input at the top. This then lets us use this data
in other applications, for example...

# Check Prerequisites Demo!

This is a simple and buggy demo that shows how one might implement a program that can read
the syntax tree of a course requirement and given a list of completed and concurrent courses,
decide if all the requirements have been met and if not print out some errors. The error
reporting code was written with less than an hour before deadline so its not that great, but
it kinda works! Also this was barely tested on more complicated formulas so it probably has
huge bugs, but hey, this bit is a lot more of a proof of concept implementation.

Mostly how it ought to work is quite straight-forward, walking a tree and checking against the list
but there are two main tricks here. Firstly we transform the syntax tree in a few ways, but mainly
so that `!` is only ever attatched to courses rather than arbitrary expressions, by using DeMorgan's 
laws. Secondly, we need to keep track of the courses we've consumed already, so one can't fulfil the
`MATH3___ * 3` course requirement by only having completed a single maths course. However when checking
under an `|` expression, if the left hand side fails, then the right hand side shouldn't evauate with
any left hand side courses consumed. Hence we pass around immutable arrays of available courses everywhere,
but hey, it works!

# Closing remarks

I'm *SO* glad that this random problem turned into writing a little DSL! ... It was a little cursed it
ended up being written all in Javascript but I do really believe that just VanillaJS and pure HTML is
the easiest way to quickly and easily mock up a nice little portable project that doesn't need any
backend or compilation at all. The best compile time is no compile time 😎

I also really enjoyed working on this project for the past couple of days and I hope it can make its
way into an official CSSA degree planner at some point! But now I'm really tired so its probably best
I get some sleep!
