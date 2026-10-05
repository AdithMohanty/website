import Nav from "./Nav";
import EntryBullets from "./EntryBullets";
import type { Metadata } from "next";
import CurrentLocation from "./CurrentLocation";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Tells Google this site is about a person, and links the profiles that are also you.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Adith Mohanty",
  url: "https://adithmohanty.com",
  affiliation: { "@type": "CollegeOrUniversity", name: "University of California, Berkeley" },
  sameAs: [
    "https://linkedin.com/in/adithmohanty",
    "https://github.com/adithmohanty",
    "https://www.instagram.com/adithjm/",
  ],
};

type Tag = { label: string; href?: string };

type EntryData = {
  title: string;
  url?: string;
  meta?: string;
  tags?: Tag[];
  sub: string;
  body: string;
  bullets?: string[];
  image?: string;
  imageAlt?: string;
  logo?: boolean;
  logoBg?: string;
};

const experience: EntryData[] = [
  {
    title: "IBM",
    url: "https://www.ibm.com/products/ibm-z-database-assistant",
    meta: "May – Aug 2026",
    sub: "Software Engineer Intern · San Jose, CA",
    body: "Built an AI-driven system that benchmarks how LLM agents perform, tailored to the mainframe environment.",
    bullets: [
      "Built a distributed evaluation harness in Python running 30 concurrent multi-turn agent trajectories against IBM's ZDBA for DB2 at up to 6,000 questions/hour, cutting manual review from days to two hours.",
      "Designed a model-based grader on watsonx combining rubric-based scoring and pairwise comparison, with a reason-before-score contract and temperature-0 decoding for deterministic, reproducible scores.",
      "Extended the grader to assess tool-call efficiency against SME-defined expected calls, revealing only 82% of trajectories used tools efficiently versus a 95% estimate, and fed flagged runs into early-stopping logic.",
      "Validated against a 12,000-question, 15-agent dataset, establishing ground-truth benchmarks at 90% agent accuracy.",
    ],
    image: "/media/ibm.svg",
    imageAlt: "IBM",
    logo: true,
    logoBg: "#ffffff",
  },
  {
    title: "DealMover.ai",
    url: "https://dealmover.ai/",
    meta: "Mar – May 2026",
    sub: "Software Engineer · San Francisco, CA",
    body: "Worked on an AI-native platform for commercial underwriting which included document ingestion, AI-assisted suggestions, and extraction of financial data.",
    bullets: [
      "Built an LLM classification pipeline (Llama 3 via Ollama) that auto-sorts and tags uploaded lending documents using scope-aware prompts and a keyword fast-path, reducing GPU compute costs by 50%.",
      "Built a multi-agent extraction pipeline that parsed 200+ earnings reports and financial documents, populating 100+ structured fields per canonical schema at 95% accuracy.",
      "Implemented formula logic linking extracted line items to auto-calculated derived metrics like EBITDA, adapting across varying company cost structures without manual reconfiguration.",
    ],
    image: "/media/dealmover.png",
    imageAlt: "DealMover.ai",
    logo: true,
    logoBg: "#14141a",
  },
  {
    title: "Cisco Systems",
    url: "https://www.cisco.com/site/us/en/products/networking/cloud-networking/application-centric-infrastructure/index.html",
    meta: "May – Aug 2025",
    sub: "Software Engineer Intern · San Jose, CA",
    body: "Built and deployed a release-management dashboard for Cisco ACI's 40-person build and infrastructure team.",
    bullets: [
      "Shipped the dashboard on Kubernetes (Django, React, PostgreSQL), tracking regression runs and test-suite results per release and cutting time spent on manual release monitoring.",
      "Implemented LDAP authentication with role-based access, letting managers reassign and view test-suite ownership.",
      "Diagnosed slow legacy queries and added a Redis caching layer, cutting dashboard load times from several seconds to roughly 100ms.",
    ],
    image: "/media/cisco.svg",
    imageAlt: "Cisco Systems",
    logo: true,
    logoBg: "#ffffff",
  },
  {
    title: "Reyes Coca-Cola Bottling",
    url: "https://reyescocacola.com/our-brands",
    meta: "Dec 2024 – Mar 2025",
    sub: "Machine Learning Engineer · Berkeley, CA",
    body: "Built sentiment-analysis models and a streaming pipeline to improve sales forecasting for 30+ products.",
    bullets: [
      "Developed sentiment models using VADER NLP, LDA topic modeling, and TF-IDF, trained on 10k+ consumer records scraped from X, Reddit, and Google via SerpApi.",
      "Cut forecast error (MAPE) by 20% with a streaming ETL pipeline (Kafka, AWS SQS) feeding live sentiment data into the forecasting model.",
      "Trained models on Berkeley GPU clusters with SLURM scheduling and deployed inference on CUDA-enabled servers.",
    ],
    image: "/media/reyes.svg",
    imageAlt: "Reyes Coca-Cola Bottling",
    logo: true,
    logoBg: "#14141a",
  },
];

const projects: EntryData[] = [
{
    title: "Fleet Middleware for Generalist Robots",
    tags: [{ label: "ongoing" }, { label: "blog", href: "/blog/generalist-robot-policies" }],
    sub: "Multi-Robot Systems · VLA(𝜋0.5) · LLM Planning(Qwen3.5-4B) · Scheduling",
    body: "Middleware that sits between a person and a fleet of robots running generalist VLA policies. It takes advantage of the fact that VLAs work best on short, concrete instructions and that they provide a common interface for different robots. One time setup for a fleet allows you to plan, assignn and track work accross the fleet.", 
    bullets: [
      "Designed a robot registry where setup is done once per robot per fleet. The registry stores each robot's capabilities, location and VLA endpoint, which the planner and scheduler use to assign work.",
      "Built an LLM planner that turns a goal like \"clean up the living room\" into a DAG(Directed Acyclic Graph) of small, single-robot steps. Planner only emits steps that match a capability some robot in the registry has.",
      "Built a scheduler that assigns each ready step to a robot based on capability, location and what it is already doing, runs independent steps in parallel, and handles handoffs where one robot's output (a full basket) is another robot's input.",
      "Each robot's VLA behind is wrapped in a common executor that sends it one language instruction at a time, watches progress through its cameras and robot state, and reports success or failure back so the planner can retry, reassign the step to another robot or replan.",
      "Testing in a MuJoCo house scene with a bimanual ALOHA at a table sorting scattered objects into a basket, and a Unitree G1 humanoid that carries each full basket to a drop-off area and brings an empty one back. The middleware keeps both busy, so the ALOHA starts on the next basket while the G1 is still delivering the last one.",
      "Building episode tracking and logging so the system can be used to collect data for training better generalist policies, and analyze the current policies' failure modes and bottlenecks.",
    ],
    image: "/media/agent.png",
    imageAlt: "ALOHA arms sorting objects into a basket in a MuJoCo house scene",
  },
  // {
  //   title: "Robot Life: A VR Game That Collects Robot Training Data",
  //   tags: [{ label: "ongoing" }],
  //   sub: "Mixed Reality · Robot Data Collection · Teleoperation · Game Design",
  //   body: "A mixed-reality game on Meta's Quest 3 where you play as a robot, and every quest you finish doubles as a labeled training episode for real robots. You don't need equipent and this way you can gain valuable data in bulk along with edge case scenarios.",
  //   bullets: [
  //     "Wrote the world as a parody to a Tesla Optimus with the ability to call Robotaxis, use Grok, and the goal which is to escape on to Mars on a Starship.",
  //     "Built two robots, one with 2 arms and 7 DoF each and one based on a humanoid. Modeled the robots to make sure that their joint limits, reach and gripper are respected in the game, so the data collected is realistic for real robots.",
  //     "Mapped the player's tracked hands and head onto the chosen robot's body, with its joint limits, reach and gripper applied in real time. The recorded motion is already in the robot's own action space instead of raw human motion that needs retargeting later.",
  //     "Stage resets if you go past joint limits, drop an object, go out of bounds, not using the gripper correctly, or if the robot collides with itself or the environment. This ensures that the data collected is valid and useful for training.",
  //   ],
  //   imageAlt: "Robot Life VR game",
  // },
  {
    title: "RL Arm Control",
    tags: [{ label: "github", href: "https://github.com/AdithMohanty/robot-arm-rl" }],
    sub: "Reinforcement Learning · Robotics · Control Systems",
    body: "A simulated robot arm built from scratch in MuJoCo that learns to pick up objects and place them in a goal zone through reinforcement learning, benchmarked against a classical control baseline.",
    bullets: [
      "Designed a custom Gymnasium environment around the MuJoCo simulation. The agent observes joint angles and speeds plus gripper and object positions, and controls joint torques, gripper lift and grip.",
      "Engineered a shaped reward that breaks the task into stages (reach, grasp, lift, deliver), which gives the agent useful learning signal on a long pick-and-place task where success alone is rare.",
      "Trained PPO and SAC agents in PyTorch using a curriculum that starts with reaching and builds up to full multi-object pick-and-place, tracking learning curves in TensorBoard.",
      "Built a classical baseline with hand-derived forward and inverse kinematics for a 2-DOF arm and torque-limited PD joint controllers, and compared the learned policy against it on success rate, time to finish and motion smoothness.",
      "Modeled the arm, gripper and scene in MuJoCo's XML format, and tuned the physics (integrator, friction model, contact settings) so objects stay in the gripper and the simulation is realistic enough to train on.",
    ],
    image: "/media/arm.png",
    imageAlt: "MuJoCo simulation of the robot arm placing balls in the goal zone",
  },
  {
    title: "FALCON: Autonomous Wildfire Detection & Mitigation",
    tags: [{label: "paper", href: "https://www.younginventorsjournal.com/wp-content/uploads/2022/09/Ponnambalam-R.-et-al._Young-Inventors-Journal-2022_9-18-56591f40.pdf"}],
    sub: "Embedded Systems · Computer Vision",
    body: "The Fire Autonomous Location Containment Network, a fixed system for high-risk areas that spots wildfires early and starts fighting them within seconds, using water piped from nearby lakes and reservoirs instead of chemical suppressants. Published in the Young Inventors Journal with a team from Dublin Robotics.",
    bullets: [
      "Designed a zoned detection network of sensor towers, each carrying a 2MP visible/NIR camera and an uncooled microbolometer thermal sensor, feeding an AI detection engine that confirms a fire is real before anything activates.",
      "Designed the suppression side: pump stations at natural water sources push water through copper pipelines to high-pressure sprinklers, and a central control tower opens only the valves for the affected zone. Pressure transmitters set the pump rate so water isn't wasted.",
      "Built alerting into the control logic: confirmed fires trigger Wireless Emergency Alerts and an SOS to nearby fire stations with live footage, while sprinklers hold the fire back until crews arrive. A manual override lets people check or bypass the automated detection.",
    ],
    image: "/media/falcon.png",
    imageAlt: "FALCON",
  },
  {
    title: "End-to-End Encrypted File Sharing",
    tags: [],
    sub: "Applied Cryptography · Systems Security · Go · CS 161",
    body: "A secure file storage and sharing client in Go, built to keep files confidential and tamper-proof even when the server storing them is fully controlled by an attacker.",
    bullets: [
      "Designed the full cryptographic protocol from scratch. Keys are derived from passwords with Argon2 and split into purpose-specific keys with HKDF. Every stored object is encrypted and then MACed (encrypt-then-MAC), and sharing invitations are protected with public-key encryption and digital signatures.",
      "Supported user login across multiple devices with no local state, plus file store, load and append. Files are stored as a linked list of encrypted chunks, so appending only sends the new data instead of re-encrypting the whole file.",
      "Built sharing as a tree of access grants. Revoking a user re-encrypts the file under new keys and moves it, which cuts off that user and everyone they shared with while every other user keeps access without noticing.",
      "Wrote an adversarial test suite that tampers with, swaps, replays and deletes server data, checking that every attack is detected instead of silently producing wrong data.",
    ],
    image: "/media/e2ee.png",
    imageAlt: "Data structure diagram of the encrypted file sharing design",
  },
    {
    title: "Pac-Man AI Agents",
    tags: [],
    sub: "Artificial Intelligence · Search · Probabilistic Inference · RL · CS 188",
    body: "A set of AI agents for Pac-Man covering the core techniques of classical AI, from search and game-playing to probabilistic tracking and reinforcement learning.",
    bullets: [
      "Implemented DFS, BFS, uniform-cost search and A*, and designed admissible, consistent heuristics for multi-goal problems like visiting every corner and eating all the food, which cut the number of nodes expanded.",
      "Built adversarial agents using minimax, alpha-beta pruning and expectimax against multiple ghosts, plus a hand-designed evaluation function to play well at limited search depth.",
      "Tracked invisible ghosts from noisy distance readings using hidden Markov models, with exact inference and particle filtering, including a joint particle filter for several ghosts at once.",
      "Trained agents with value iteration, Q-learning and approximate Q-learning over hand-built features, and built neural networks from scratch for digit classification and language identification.",
    ],
    image: "/media/pacman.png",
    imageAlt: "Pac-Man agent tracking ghosts with belief distributions",
  },
  {
    title: "Memory Safety & Web Exploits",
    tags: [],
    sub: "Offensive Security · C · x86 · CS 161",
    body: "Hands-on attacks against deliberately vulnerable programs and a web app, used to learn how real-world defenses fail and how to fix them.",
    bullets: [
      "Exploited C programs through stack buffer overflows, off-by-one errors, format string bugs and return-to-libc, getting around stack canaries, non-executable stacks and ASLR by reading memory layouts in GDB.",
      "Attacked a web application with SQL injection, stored and reflected XSS, and CSRF, then described the fix for each: parameterized queries, output escaping, CSRF tokens and cookie flags.",
    ],
    image: "/media/exploits.png",
    imageAlt: "GDB session showing a stack layout during an exploit",
  },
  {
    title: "Machine Learning from Scratch",
    tags: [],
    sub: "Machine Learning · NumPy · PyTorch · CS 189",
    body: "Core machine learning models implemented from first principles and tested on real datasets through Kaggle competitions.",
    bullets: [
      "Built a fully connected neural network and a CNN in pure NumPy, including forward and backward passes, weight initialization and optimizers, and checked the gradients numerically before rebuilding the models in PyTorch.",
      "Implemented decision trees and random forests with entropy-based splits, and Gaussian discriminant analysis (LDA and QDA), and applied them to spam detection, Titanic survival and MNIST.",
      "Trained SVMs with cross-validated hyperparameter search and feature engineering for spam and image classification, and submitted predictions to class Kaggle competitions.",
    ],
    image: "/media/ml.png",
    imageAlt: "Training curves and decision boundaries from the ML models",
  },
    {
    title: "Distance-Vector Router",
    tags: [],
    sub: "Socket Programming · Distributed Systems · Python · CS 168",
    body: "A distributed routing protocol built from scratch, mirroring the core mechanisms behind BGP and RIP.",
    bullets: [
      "Routers exchange advertisements and run Bellman-Ford to compute shortest-path forwarding tables across a multi-router network simulation.",
      "Implemented loop prevention (split horizon, poison reverse) and convergence optimizations (triggered updates, route expiration) for fast, stable reconvergence after topology changes.",
    ],
    image: "/media/router.png",
    imageAlt: "Network topology of the distance-vector router simulation",
  },
  {
    title: "Build Your Own World",
    tags: [],
    sub: "Data Structures · Procedural Generation · Java · CS 61B",
    body: "A 2D tile-based exploration game in Java with worlds generated from a seed. The same seed always produces the same world.",
    bullets: [
      "Wrote a procedural generator that places non-overlapping rooms and connects them with hallways, using a seeded random number generator so any world can be rebuilt exactly from its seed.",
      "Guaranteed every room is reachable by connecting rooms through a graph and checking connectivity with disjoint sets.",
      "Built the interactive layer: keyboard movement, a HUD that describes the tile under the mouse, and save/load that replays the stored input history so a game resumes exactly where it left off.",
    ],
    image: "/media/byow.png",
    imageAlt: "Procedurally generated tile world from the BYOW game",
  },

];

function Media({
  src,
  alt,
  logo,
  logoBg,
}: {
  src?: string;
  alt?: string;
  logo?: boolean;
  logoBg?: string;
}) {
  return (
    <div
      className={`entry-media${logo ? " entry-media--logo" : ""}`}
      style={logo && logoBg ? { background: logoBg } : undefined}
    >
      {src ? (
        <img src={src} alt={alt ?? ""} loading="lazy" />
      ) : (
        <svg
          className="entry-media-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.6" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="entry-arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

function Entry({ e }: { e: EntryData }) {
  return (
    <article className="entry">
      <Media src={e.image} alt={e.imageAlt} logo={e.logo} logoBg={e.logoBg} />
      <div className="entry-main">
        <div className="entry-head">
          <h2 className="entry-title">
            {e.url ? (
              <a className="entry-title-link" href={e.url}>
                {e.title}
                <ArrowIcon />
              </a>
            ) : (
              e.title
            )}
          </h2>
          {e.tags ? (
            <div className="tags">
              {e.tags.map((t) =>
                t.href ? (
                  <a key={t.label} className="tag" href={t.href}>
                    {t.label}
                  </a>
                ) : (
                  <span key={t.label} className="tag">
                    {t.label}
                  </span>
                )
              )}
            </div>
          ) : e.meta ? (
            <span className="entry-meta">{e.meta}</span>
          ) : null}
        </div>
        <p className="entry-sub">{e.sub}</p>
        <p className="entry-body">{e.body}</p>
        {e.bullets && <EntryBullets bullets={e.bullets} />}
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="hero">
        <Nav />
        <div className="hero-inner">
          <div className="hero-media" aria-hidden="true">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster="/media/background-poster.jpg"
              >
                <source src="/media/background.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="hero-content">
              <h1 className="name" id="about">Adith Mohanty</h1>
          <p className="tagline">
            Data Science &amp; Applied Mathematics · UC Berkeley
          </p>

      <div className="intro">
        <p>
          Hey! I like to make cool things and work on hard problems. I have worked across the stack building
          AI products in infrastructure, finance, and developer tools.
        </p>
        <p>
          I value environments where my work is used on day 1. I build for the moment someone uses it, whether that's excitement or relief that a problem is gone.
          Most recently, at IBM, I built LLM agent evals that run on mainframe environments, which cut agent review from days to hours and helped the team ship faster. 
        </p>
        <p>
          I'm currently exploring physical AI through classes (EECS 116, CS 188), <a href="#projects">projects</a>, and pulling all nighters in MuJoCo. Robotics isn't new for me, though. I led a VEX Robotics team to
          the <a href="https://www.youtube.com/watch?v=DDMdYiVO75k">State</a> and <a href="https://youtu.be/0OnV3VFDlbg?si=lYBwgYalrfeDz3ol&t=234">National</a> Championships and won awards for both hardware and control at 20+ competitions.
        </p>
        <CurrentLocation />
      </div>

      <p className="links">
        <a href="mailto:adithm@berkeley.edu">Email</a>
        <span className="sep">/</span>
        <a href="https://linkedin.com/in/adithmohanty">LinkedIn</a>
        <span className="sep">/</span>
        <a href="https://github.com/adithmohanty">GitHub</a>
        <span className="sep">/</span>
        <a href="https://www.instagram.com/adithjm/?hl=en">Instagram</a>
        <span className="sep">/</span>
        <a href="/AdithMohantyResume.pdf" download="AdithMohantyResume.pdf">Resume</a>
            </p>
            </div>
        </div>
      </header>

      <main className="page-body">
        <p className="section-label" id="experience">Experience</p>
      <div className="rule" />
      {experience.map((e) => (
        <Entry key={e.title} e={e} />
      ))}

      <p className="section-label" id="projects">Projects</p>
      <div className="rule" />
      {projects.map((e) => (
        <Entry key={e.title} e={e} />
      ))}
      </main>
    </>
  );
}
