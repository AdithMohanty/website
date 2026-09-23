import Nav from "./Nav";
import EntryBullets from "./EntryBullets";
import CurrentLocation from "./CurrentLocation";

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
    body: "Built an AI-driven system that benchmarks how LLM agents perform in production, tailored to the mainframe environment the product runs on.",
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
    sub: "Software Engineer · AI-native commercial underwriting",
    body: "Worked on an AI-native platform for commercial underwriting: document ingestion, AI-assisted suggestions, and extraction of financial data.",
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
    sub: "Machine Learning Engineer (Contract) · Berkeley, CA",
    body: "Built sentiment-analysis models and a streaming pipeline to improve sales forecasting.",
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
    title: "Distance-Vector Router",
    tags: [{ label: "github", href: "https://github.com/adithmohanty" }],
    sub: "Python · Socket Programming · Distributed Systems",
    body: "A distributed routing protocol built from scratch, mirroring the core mechanisms behind BGP and RIP.",
    bullets: [
      "Routers exchange advertisements and run Bellman-Ford to compute shortest-path forwarding tables across a multi-router network simulation.",
      "Implemented loop prevention (split horizon, poison reverse) and convergence optimizations (triggered updates, route expiration) for fast, stable reconvergence after topology changes.",
    ],
    image: "/media/router.png",
    imageAlt: "Network topology of the distance-vector router simulation",
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
          AI products in infrastrucutre, finance, and developer tools.
        </p>
        <p>
          I value environements where my work is used on day 1. Building systems that spark excitement or have use is why I build.
          Most recently I was able to do this at IBM, building systems for LLM agent evals that uniquely run on production mainframe environments.
        </p>
        <p>
          I am currently exploring physical AI through classes (EECS 116, CS 188), projects (cool robot arm), and pulling all nighters in MuJoCo. I also led a VEX Robotics team to
          the State and National Finals, and won both hardware and control awards at over 20+ competitions.
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
