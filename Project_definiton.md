This project should be an educative webstie for students to play around with ML on an agrictulral task and hsould be hosted on github.

The idea is that that the students play on a farm, which now uses robots and automated system where this farmer will now use ml for some specific task. 

So how could such a tak look like, this farmer has many apple trees and he ahs robots that drive around and pick the apples. we have a simpel dataset of apples which are red and green, we can maybe change the pictures all a bit and agument our dataset.
The idea is that our robot only picks the red apples since they are worth more than the green ones. 
Maybe there are some apples that have a worm looking out, those we should pick and trash.

We will have a training set that the student also can look at so that he udnerstand a bit better how the data looks like, and we have the test sets which are  a larger colletion of data of which we just select like 20% of randmly, portraying the current harvest.

So now we come to the the cofniguartion the sutdents can do, lets keep it simpel for now but maybe we can extend more ml aspects later, so we want to let them tune hyper parameters.
So they can chose between how many layers the nn models hav how wide and deep they are, maybe have a bar that show how strongly we loss regulariation, if they have no dropout or something (not sure right now all loss regulariation methods) the models will hyper tune and only select one form of perfrect red round apple and not all red apples.
if regulazation is to strong it slect alls apples at the sweet spot the worm apples also get deselected.

All those things should be done quit simply for the students also not with too many options to simplify. the idea is that the models and weights are pretrained in the different combinations, and maybe we fake it a little bit so that that
our points that we try to teach are emphasized well.

So this is the genereal idea, the website should look nice and be simpel. a page to see the farm, currently only the apple farm is selectable maybe later more. and for each taska  screen will come that shows us the settings we can save.
the idea is that later the students can change those settings for different ml models for different tasks that teach different point. Like maybe we have a doctor for  the animals for a speciffic skin disease and there wwe want to also pick 
rater falge postiives than the opposite, because its better to go to the doctor once to many time sthan the few and so on.

The students should then be able to configure all and then let a month run and then they make more or less money depending on each category.

There should also be explanations to the theory available as help buttons, but we will also be teaching along they play.

It should be designed for on laptop now but also for mobile later.