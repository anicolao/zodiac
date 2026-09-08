Zodiac is a concept to convert pictures of gameplay into a zodiac image as a sharable memento of the game. zodiac.png is an example of the intended output, while the input would be a photo like example1.jpg or example2.jpg. We want to implement this as a svelte SPA with serviceworker/full screen bookmark support so that hte user can bookmark it to the homescreen of their iPhone and generate the sharable image by snapping photos during the game and generating the zodiac at the end, and then make the resulting image easy to share. Write a README.md, VISION.md, MVP_DESIGN.md, and UX_DESIGN.md for this project, using image generation to make mock-ups for the UX design. I will then review these documents before we begin implementation. Record all prompts I give you for this project in PROMPTS.md for later reference, verbatim and without commentary.

in terms of the open questions: MVP is for a 6-card game; card names must come from the printed card in the photograph; token size should be recorded/reproduced; art is approved; local only is a requirement. in terms of testing, copy hte E2E_GUIDE and approach from ../../food and ../jaipur; use image generation to create fixtures that look like the example images provided so that the e2e test can have a complete run-through from game initiation to zodiac completion. Let's use gh to create a new public github repository, add an IMPLEMENTATION_PLAN.md to the repo as well as the existing documents, and then build the application and put it up as the first PR.

I don't see a preview lnk on the PR, look at the reference projects for how to do it an publish a gh pages link to see the PR

this looks pretty good. A few things to fix: after completing a game, the zodiac should get saved into a game history so the user can recover and reshare old zodiacs. the actual zodiac image has the stars a bit crowded, they could be further out from the center so that htey have a bit more space in the finished zodiac, and perhaps be a bit smaller. Let's update with these changes.

I need a way to tell what build is deployed - the git hash in small text or similar - as I don't see your changes on teh PR preview without a cache-busting URL. I do like teh app being offline first, but need to be able to tell if the user is out of date. let's put that up as a new PR

what is the image processing/recognition approach implemented so far? In practice, it doesn't work reliably on photos. Describe only for now.

ok. In assets/examples, I have added a series of photos that more accurately reflects the intended reality. Photos are at different angles; the position and directionality of the text card is arbitrary but defines which way is "up" for the constellation; and the constellations are coloured tokens on a black background. Let's make a new route in our dev server called "fixtures" that will display these fixtures and generate a .json record for each that records the correct/expected output for each -- perhaps draw a circle around each star, a bounding box around the text, and an arrow indicating "north/up". Then I'll review the fixtures route to ensure that our test data are correctly annotated before we rewrite the algorithm for these examples. You may move and resize the images as desirable to incorporate them wherever you feel makes sense to build up a regressoin test data set.

The north arrow should always point straight up relative to the bounding box. Teh bounding bos should be constrained to be an actual rectangle not an arbitrary quadrilateral. Let's put up those updates for inspection

OK I hvae updated the fixtures. Do we have tests that validate recognition handles these images now? do they still pass with my changes to the fixture json?

fix the files, the editor, add the real test, and then make it green.

Let's put this branch up as a PR

Read Gmail - Zodiac prototype.pdf and summarize its feedback as GMAIL_FEEDBACK.md for review before implementing.

OK let's put up a PR that fixes all these points in focused commits.

OK I put the photos that go with these issues in issue_photos. Looks liek the current roiund both works poorly and doesn't handle some new requirements. update the PR accordingly. Issue list: Issue: There are now 6 words per card. Cards always have a thin gold border, and gold numbers (1-6, corresponding to the 6 words), with dark blue text for the actual words themselves. The card will always be above the constellation, oriented upright. The photo might be taken rotated, or even upside down, but make sure it's properly rotated with the card above the constellation before running the OCR. Then run OCR on the 6 words and their corresponding numbers (1-6). There will always be a black die with a white number in the picture, and the number on the die shows which of the words should be displayed in the text field. For example, if the die shows the number "2", then the word to be recognized is the one labelled with the gold "2". Do not put the gold number into the text field - only use the blue text - and only use the one word corresponding to the die.
 Photos-1-001 (1).zip

Issue: If no card is detected, the OCR usually gives gibberish
It should show no text in the text box, instead of gibberish. Maybe the confidence threshold needs to be adjusted.

Issue: Sometimes the constellation is squished together in the zodiac, and the stars are too small.
The stars should always be the same size in the zodiac, and the shape should always expand to fill the available space in the zodiac section it's in (with reasonable space around the edge so it doesn't look too crowded). The important thing is making sure every constellation in the zodiac looks around the same size, and with yellow stars the same size as other yellow stars, and red stars the same size as other red stars.

Issue: If the picture is taken rotated (i.e. the text is not upright and the constellation is rotated), sometimes the constellation appears too small in the zodiac, and with the incorrect rotation. Also, if the picture is taken exactly upside down, the OCR does not rotate the text, it just recognizes the text wrong.
It should always assume the card is positioned above the constellation, and rotate the text, and constellation, for that orientation.
