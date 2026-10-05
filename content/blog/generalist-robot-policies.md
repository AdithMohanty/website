---
title: Generalist Robot Policies: Where VLAs Are and What Comes Next
date: 2026-10-04
summary: An introduction to vision-language-action models, two years of Physical Intelligence's research, and why I think the next problem is coordinating a fleet of robots, not making one robot smarter.
tags: Robotics
---

For most of robotics history, getting a robot to do something meant building a system for that one thing. You wrote a controller for picking up a cup, collected demos for folding a towel, or trained an RL policy for opening one specific drawer. Every new task, robot or room meant starting over.

That's changing quickly. Over the last two years, a new kind of model, the vision-language-action model (VLA), has made it possible to run one policy across many tasks, many robots and many places it has never seen. This post covers what VLAs are, how Physical Intelligence's research has pushed them forward, and what I think the next problem is. That problem is what my current project is about.

---

## What is a VLA?

A VLA is a model that takes in camera images, the robot's current state, and a language instruction like "put the cup in the sink", and outputs actions: joint positions or gripper commands, usually many times per second.

The trick is where these models come from. Most VLAs start from a vision-language model (VLM) that was pretrained on internet images and text, so it already knows what a cup is, what "the red one on the left" means, and roughly how the world is laid out. Robot data is then used to teach that model to output actions too. The internet knowledge carries over, which is why a VLA can handle objects and instructions that never showed up in its robot data.

A **generalist policy** is the goal these models are working toward: one model that can do many tasks, on many kinds of robots, in places it has never been, without being retrained for each one.

---

## Two years of Physical Intelligence

[Physical Intelligence](https://www.pi.website/) (π) has published a lot of the work that defines where VLAs are today. Reading their research in order is a good way to see how the field has moved.

### π0: the first generalist policy (Oct 2024)

[π0](https://www.pi.website/blog/pi0) put a pretrained VLM together with a separate "action expert" that uses flow matching to output smooth, continuous action chunks at up to 50 Hz. It was trained on data from many different robots (single arms, two-arm setups, mobile robots) and could fold laundry, bus tables and assemble boxes. These are dexterous, multi-step tasks that earlier models struggled with.

The important idea was cross-embodiment: one set of weights, many robot bodies. Data from one robot helped the others.

### FAST and open-sourcing (Jan – Feb 2025)

[FAST](https://www.pi.website/research/fast) is a new way to turn robot actions into tokens. It compresses action sequences with a frequency transform (the same idea behind JPEG) before tokenizing them, which made training autoregressive VLAs about 5x faster. Shortly after, π [open-sourced π0 and π0-FAST](https://www.pi.website/blog/openpi), which is why so many labs (and students like me) can now fine-tune a real generalist policy.

### Hi Robot: thinking before acting (Feb 2025)

[Hi Robot](https://www.pi.website/research/hirobot) split the robot's brain into two levels. A high-level VLM reads the user's prompt and the scene, then breaks the job into short, simple language commands ("pick up the lettuce") for the low-level VLA to carry out. Because the high level thinks in language, it can handle complicated requests and take corrections mid-task, like "that's not trash".

This is the paper that matters most for my project, because it shows something important: **VLAs work best when they are given small, concrete steps, and something above them should handle the planning.**

### π0.5: open-world generalization (Apr 2025)

[π0.5](https://www.pi.website/blog/pi05) trained on a much wider mix of data (robot data, web data, and high-level language labels) and put the subtask prediction and action generation inside one model. The result was a mobile robot that could clean up kitchens and bedrooms in homes it had never seen. That was one of the first convincing demos of a robot policy working outside the lab where it was trained.

### Making VLAs train and run faster (May – Jun 2025)

Two papers took on practical problems. [Knowledge insulation](https://www.pi.website/research/knowledge_insulation) keeps the action expert's training from damaging the VLM's internet knowledge, so models train faster and generalize better. [Real-time action chunking](https://www.pi.website/research/real_time_chunking) deals with the fact that big models are slow: the robot keeps executing its current chunk of actions while the next chunk is being computed, and the new chunk is made to blend smoothly with what is already happening. Without this, large models pause or jerk between chunks.

### π*0.6 and RL: learning from experience (Nov 2025 – Mar 2026)

Imitation only gets a robot as good as its demos. [π*0.6](https://www.pi.website/blog/pistar06) introduced RECAP, a way to improve a VLA with reinforcement learning using the robot's own attempts plus human corrections. It made the robot noticeably faster and more reliable on tasks like making espresso, folding laundry and assembling boxes. Later, [RL tokens](https://www.pi.website/research/rlt) made this much cheaper: a small RL policy plugs into the VLA through a special output token and sharpens one precise step (like lining up a screwdriver) using just hours of practice, without retraining the whole model.

Alongside this, π found that [transfer from human videos to robots](https://www.pi.website/research/human_to_robot) emerges as models scale, which matters because human video is far easier to collect than robot data.

### Memory and long tasks (Mar 2026)

[MEM](https://www.pi.website/research/memory) gave VLAs short-term memory (recent video frames) and long-term memory (a running natural-language summary of what has been done), so a robot can work through tasks up to about fifteen minutes long, like cleaning a whole kitchen. One line from the post stuck with me: as the individual skills get more robust, the bottleneck is increasingly how the robot uses those skills to finish a complex job, not the skills themselves.

### π0.7: a steerable generalist (Apr 2026)

[π0.7](https://www.pi.website/blog/pi07) is π's latest model. It matches their RL-tuned specialist models out of the box and shows early signs of **compositional generalization**: combining skills it learned separately to solve new tasks, like using a kitchen appliance it was never trained on. The key was richer prompts. Along with the language instruction, the model can be told how to do the task (speed, quality, control mode) and shown a picture of what the end of the current step should look like.

---

## Where this leaves us

Put together, a few trends stand out:

- **One model, many robots.** Cross-embodiment training works, and it keeps getting better.
- **Generalization is real now.** Robots running these models handle new homes, new objects and new instructions.
- **Hierarchy wins.** Hi Robot, π0.5, MEM and π0.7 all use some form of a high-level planner that hands short instructions to a low-level policy.
- **The models are becoming a platform.** π describes this as a ["physical intelligence layer"](https://www.pi.website/blog/partner): companies like Weave are already building products on top of π's models instead of training their own from scratch.

That last point is the one I keep thinking about. If the model becomes something you build on, like an LLM API, the hard question changes. It's no longer *"how do I get my robot to do this task?"* It's **"I have a bunch of different robots. How do I get them to do this job together?"**

Every piece of the research above is about one robot doing one job. Real deployments won't look like that. A home, warehouse or hospital will have several robots with different bodies and abilities: a two-arm station that's great at fine manipulation, a humanoid that can walk and carry things, a mobile base that can reach high shelves. Someone has to decide who does what, in what order, and what to do when something fails.

---

## What I'm building

That is what my current project is: **middleware for fleets of robots running generalist policies.**

The idea takes the hierarchy from Hi Robot and π0.5 and adds a level above it, across robots instead of inside one:

1. **Register your robots once.** You tell the system what robots you have and what they can do: what kind of body each one has, what policy it runs, the short instructions it handles well, and where it can reach or travel.
2. **Send a goal in plain English.** Something like "clean up the living room".
3. **An LLM plans it.** The goal gets broken into small, single-robot steps, the kind of concrete instructions VLAs are good at, with dependencies between them ("the basket has to be full before it can be carried").
4. **A scheduler runs it.** Each step goes to a robot that can do it, independent steps run at the same time, and when a step fails the system can retry it, give it to another robot or replan.

To test it, I set up a house scene in MuJoCo with two very different robots. A bimanual **ALOHA** sits at a table sorting scattered objects into a basket. A **Unitree G1** humanoid carries each full basket to a drop-off area and brings back an empty one. Neither robot can do the whole job alone, and the interesting part is the handoff: the ALOHA should be sorting into a fresh basket while the G1 is still delivering the last one.

It's still in progress, and I'll write more about how the planner and scheduler work (and where they break) in a later post. You can follow along on the [projects section](/#projects) of my site.

Thanks for reading!
