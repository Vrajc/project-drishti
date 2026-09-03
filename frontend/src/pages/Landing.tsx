import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  Shield,
  Users,
  AlertTriangle,
  MapPin,
  Brain,
  Eye,
  Video,
  Cpu,
  Share2,
  Database,
  ScanLine,
  Radio,
  Siren,
  Layers,
  Lock,
  Activity,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import FloatingElements from '../components/FloatingElements';
import GradientButton from '../components/GradientButton';
import FeatureCard from '../components/FeatureCard';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import AnimatedHeroText from '../components/AnimatedHeroText';
import HeroButtonExpandable from '../components/HeroButtonExpandable';
import LandingHeader, { NavSection } from '../components/landing/LandingHeader';
import ScrollProgress from '../components/landing/ScrollProgress';
import SectionLabel from '../components/landing/SectionLabel';
import TechMarquee from '../components/landing/TechMarquee';
import PipelineFlow, { PipelineStep } from '../components/landing/PipelineFlow';
import RoleTabs, { RoleDefinition } from '../components/landing/RoleTabs';
import FaqAccordion, { FaqItem } from '../components/landing/FaqAccordion';
import CountUp from '../components/landing/CountUp';
import OrbitHud from '../components/landing/OrbitHud';

/* ---------------------------------------------------------------------------
   Page content. Kept out of the component so the markup below stays readable,
   and so every claim on this page sits in one place where it can be checked
   against docs/HLD.md, docs/SCALE-80K.md and the source itself.
   --------------------------------------------------------------------------- */

const NAV_SECTIONS: NavSection[] = [
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'roles', label: 'Roles' },
  { id: 'proof', label: 'Proof' },
  { id: 'faq', label: 'FAQ' },
];

const STACK = [
  'YOLOv8',
  'ByteTrack',
  'MediaMTX',
  'Redis Streams',
  'FastAPI',
  'PostgreSQL',
  'Prisma',
  'Socket.IO',
  'Express',
  'React 18',
  'Leaflet GIS',
  'HLS.js',
  'WebRTC',
  'Docker Compose',
];

const CAPABILITIES = [
  {
    icon: Shield,
    title: 'AI Pre-Safety Planning',
    description: 'Intelligent placement of safety infrastructure before events begin',
    points: [
      'Venue zones drawn as polygons on the map',
      'A capacity threshold set per zone, not per venue',
      'The plan carries into monitoring as live thresholds',
    ],
    metric: { value: 'Zone-level', label: 'capacity model' },
  },
  {
    icon: Users,
    title: 'Crowd Flow Analysis',
    description: 'Predict bottlenecks and congestion 15-20 minutes in advance',
    points: [
      'Occupancy from ray-casting detection boxes against zone polygons',
      'One density row per zone per interval, never per frame',
      'Placement logic verified identical over 10,000 random points',
    ],
    metric: { value: '15-20 min', label: 'early warning' },
  },
  {
    icon: AlertTriangle,
    title: 'Anomaly Detection',
    description: 'Real-time detection of emergencies, fires, and safety threats',
    points: [
      'Capacity breach and crowd surge evaluated on every reading',
      'A camera going dark raises its own incident',
      'Each firing writes a real incident row, attributed to the rule',
    ],
    metric: { value: '3 rules', label: 'raise incidents' },
  },
  {
    icon: MapPin,
    title: 'Smart Dispatch',
    description: 'Automated emergency response with optimal routing',
    points: [
      'Incident queue with unit assignment across departments',
      'Straight-line distance shown, and labelled as straight-line',
      'ETA stays empty until a real router can answer it',
    ],
    metric: { value: '30 units', label: 'seeded estate' },
  },
  {
    icon: Brain,
    title: 'AI Summaries',
    description: 'Conversational insights about event safety status',
    points: [
      'Plain-language questions answered from the event’s own rows',
      'Risk read-out for the state the event is in right now',
      'Post-event reports generated from what was recorded',
    ],
    metric: { value: 'Natural', label: 'language queries' },
  },
  {
    icon: Eye,
    title: 'Live Monitoring',
    description: 'Comprehensive dashboard for event safety oversight',
    points: [
      'HLS and WebRTC playback straight from the stream layer',
      'Density, incidents and alerts pushed over one socket',
      'A camera nobody has contacted reads grey, never green',
    ],
    metric: { value: '30 s', label: 'health probe' },
  },
];

const PIPELINE: PipelineStep[] = [
  {
    icon: Video,
    actor: 'mediamtx',
    title: 'Ingest',
    description:
      'Cameras publish RTSP. The stream layer republishes every path as HLS and WebRTC, so a browser plays live video with no plugin and no vendor client.',
    facts: ['RTSP 8554', 'HLS 8888', 'WebRTC 8889', 'Any existing VMS'],
  },
  {
    icon: Cpu,
    actor: 'ai-service',
    title: 'Detect',
    description:
      'One asyncio worker per camera decodes every third frame and runs YOLOv8 detection with ByteTrack association, so an object keeps the same identity from frame to frame instead of being counted twice.',
    facts: ['Python 3.11', 'FastAPI', 'YOLOv8 + ByteTrack', '~8 inferences/s/camera'],
  },
  {
    icon: MapPin,
    actor: 'zones.py',
    title: 'Place',
    description:
      'Detection centres are ray-cast against the venue’s zone polygons to give occupancy per zone. Where boxes cannot be placed, occupancy is empty — which is not the same as every zone being empty.',
    facts: ['Point-in-polygon', 'Verified over 10,000 points', 'Empty ≠ zero'],
  },
  {
    icon: Share2,
    actor: 'publisher.py',
    title: 'Publish',
    description:
      'One event per detection onto a Redis Stream, against a contract both sides compile against. Two independent consumer groups read the same stream, so a stall on one side cannot hold up the other.',
    facts: ['drishti:detections', '2 consumer groups', 'One shared contract'],
  },
  {
    icon: Database,
    actor: 'detectionConsumer',
    title: 'Persist and evaluate',
    description:
      'The batch is grouped by frame, written as one density row per zone per interval, and handed straight to the rule engine, which raises an incident wherever a threshold is crossed.',
    facts: ['CrowdDensity', 'ZONE_CAPACITY_BREACH', 'CROWD_SURGE'],
  },
  {
    icon: ScanLine,
    actor: 'matchEngine',
    title: 'Match',
    description:
      'On its own consumer group: a sampled detection, a track point at the camera’s surveyed position, and a normalised plate compared against active watchlist entries. A match raises an alert; an exact match carries no score, because nothing was inferred.',
    facts: ['Edit-distance scoring', 'TrackPoint', 'Cross-camera trail'],
  },
  {
    icon: Radio,
    actor: 'Socket.IO',
    title: 'Push',
    description:
      'Density, incident and alert events go to the estate room and to the relevant event room. The police console and the organizer’s monitoring pages update without anyone pressing refresh.',
    facts: ['crowd:density', 'incident:new', 'alert:new'],
  },
];

const ROLES: RoleDefinition[] = [
  {
    id: 'organizer',
    label: 'Organizer',
    icon: Layers,
    headline: 'Plan it, watch it, account for it',
    summary:
      'The full event lifecycle in one workspace: define the venue and its zones, borrow cameras from the estate for the duration, watch density and incidents as they happen, and leave with a report built from what was actually recorded.',
    abilities: [
      'Event setup, and editing without losing recorded history',
      'Pre-event safety planning per zone',
      'Live monitoring with density and incident feeds',
      'Crowd flow analysis and bottleneck warning',
      'Anomaly review with incident status workflow',
      'Emergency dispatch requests',
      'Conversational AI summaries of the current state',
      'Post-event reporting and export',
    ],
    screens: [
      '/organizer-dashboard',
      '/event-setup',
      '/pre-safety-planning',
      '/live-monitoring',
      '/crowd-flow-analysis',
      '/anomaly-detection',
      '/ai-summaries',
      '/post-event-reports',
    ],
    boundary:
      'No estate-wide registry, no watchlist, no vehicle tracking. An organizer may only assign cameras to an event they own, and may only release cameras currently on one of their events.',
  },
  {
    id: 'police',
    label: 'Police',
    icon: Siren,
    headline: 'A jurisdiction, not a venue',
    summary:
      'The surveillance layer exists independently of any event: departments, sites and cameras with real coordinates, health history, live wall, watchlist matching and cross-camera vehicle tracking. A district could deploy only this half.',
    abilities: [
      'Camera registry across departments and sites',
      'GIS map with per-camera health state',
      'Live wall of concurrent streams',
      'Watchlist entries with CSV import',
      'Alert feed with a triage workflow',
      'Cross-camera vehicle trail with a time scrubber',
      'Detection search with facets',
      'Dispatch console with unit assignment',
    ],
    screens: [
      '/police/overview',
      '/surveillance/cameras',
      '/surveillance/map',
      '/surveillance/live-wall',
      '/police/watchlist',
      '/police/alerts',
      '/police/tracking',
      '/police/dispatch',
    ],
    boundary:
      'A police account cannot be self-registered. The role is granted by an administrator, and every route is authorised on the server as well as guarded in the browser.',
  },
  {
    id: 'participant',
    label: 'Participant',
    icon: Users,
    headline: 'The attendee gets their own app',
    summary:
      'Attendees see the event, not the operations console. Discovery, registration, and a live view built for someone standing in the crowd rather than someone watching it from a control room.',
    abilities: [
      'Browse and search published events',
      'Register in a couple of taps',
      'Live updates for events they joined',
      'Emergency contacts always one tap away',
      'Venue location and navigation',
    ],
    screens: ['/participant-dashboard', '/explore-events', '/my-events', '/live-updates'],
    boundary:
      'No camera feeds, no incident queue, no other attendee’s data. The participant view was split from the organizer console precisely so the two could never be confused.',
  },
  {
    id: 'admin',
    label: 'Administrator',
    icon: Lock,
    headline: 'Who is allowed to see what',
    summary:
      'Platform oversight: accounts, role grants, event approval and the configuration that everything else runs on. The only place where a police or admin role can be handed out.',
    abilities: [
      'User management across every role',
      'Role grants, including police and admin',
      'Platform-wide analytics',
      'Event oversight and approval',
      'Access control and system configuration',
    ],
    screens: ['/admin-dashboard'],
    boundary:
      'Elevation is deliberate and logged. Registration refuses the admin and police roles outright, so the only path to one is an explicit grant.',
  },
];

const FAQ: FaqItem[] = [
  {
    question: 'Does this need new cameras?',
    answer:
      'No. Cameras are addressed by URL, so any existing installation that can publish RTSP needs no change — point the registry at it. ONVIF fields are stored for devices that support discovery and PTZ, and the health poller speaks plain RTSP and HTTP including digest auth, so it works against real hardware without a vendor SDK.',
  },
  {
    question: 'What works if the detector is not running?',
    answer:
      'Everything except the stream layer and the detector runs on Node and Postgres alone. The camera registry, health poller, map, watchlist and dispatch all work; pages that need detections show their empty state and say why. That is the intended behaviour, not a failure mode.',
  },
  {
    question: 'How does this scale past one venue?',
    answer:
      'The detector is a container that reads RTSP and publishes to Redis, so it runs at the edge on a Jetson beside the camera or centrally in a district data centre with no change to the contract. Frame stride is an environment variable, so a district under load can halve its inference cost without a redeploy, at the cost of temporal resolution.',
  },
  {
    question: 'Where do the numbers on a dashboard come from?',
    answer:
      'Every one of them is a real detection, a real database row, or a real computation. Where a real value does not exist yet, the interface says so: a camera nobody has contacted reads "Not yet probed" in grey, not red, and a cross-camera link with no plate is labelled probable and capped below certainty.',
  },
  {
    question: 'Is an event required to use it?',
    answer:
      'No. The camera registry is standalone — departments, sites, cameras with GIS and health history, none of which depends on an event existing. The event layer is additive: an organizer borrows registry cameras for the duration of an event, and gives them back.',
  },
  {
    question: 'How is access separated between roles?',
    answer:
      'Every route is authorised on the server, and guarded again in the browser so a signed-out user lands on the login page instead of a screen of failed requests. Participants never reach the operations consoles, organizers never reach the estate registry, and the admin and police roles cannot be self-registered.',
  },
];

const NOT_BUILT = [
  {
    title: 'Face matching',
    detail: 'The embedding column exists and is null on every row. A person entry is a record only.',
  },
  {
    title: 'Road-distance ETA',
    detail: 'The console says "ETA unavailable". Straight-line distance is shown, labelled as such.',
  },
  {
    title: 'Observed frame rate',
    detail: 'The health probe does not decode video, and only a decoder can report a frame rate honestly.',
  },
  {
    title: 'PTZ control',
    detail: 'Whether a camera is PTZ-capable is recorded. Nothing in this build drives the motor.',
  },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);

  // Fade the hero against its own height rather than the whole document, so
  // adding sections below never changes how the hero behaves.
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const opacity = useTransform(heroProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(heroProgress, [0, 0.75], [1, 0.95]);

  useEffect(() => {
    document.title = 'Drishti - AI-Powered Event Safety';
  }, []);

  useEffect(() => {
    let frame: number | undefined;
    const read = () => {
      frame = undefined;
      setShowTop(window.scrollY > window.innerHeight);
    };
    const onScroll = () => {
      if (frame === undefined) frame = requestAnimationFrame(read);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  const goto = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="relative min-h-screen overflow-hidden bg-ai-black text-ai-white">
      <ScrollProgress />

      {/* --- Background stack, back to front ------------------------------ */}
      <ParticleHero />
      <div aria-hidden="true" className="landing-aurora pointer-events-none fixed inset-0 z-0" />
      <Spotlight />
      <div aria-hidden="true" className="grid-background fixed inset-0 z-0 opacity-40" />
      <FloatingElements />
      <div
        aria-hidden="true"
        className="grain-overlay pointer-events-none fixed inset-0 z-[1] hidden sm:block"
      />

      <LandingHeader
        sections={NAV_SECTIONS}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      {/* ================================================================
          HERO
          ================================================================ */}
      <section
        ref={heroRef}
        className="hero-min-h min-h-screen-safe relative flex items-center pb-16 pt-24 sm:pb-24 sm:pt-32"
      >
        <motion.div className="page-container relative z-10" style={{ opacity, scale }}>
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Left: the pitch */}
            <div className="space-y-6 sm:space-y-8">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-ai-gray-800 bg-ai-gray-900/60 py-1.5 pl-2 pr-3.5 backdrop-blur-sm"
              >
                <span className="rounded-full bg-ai-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ai-black">
                  Live
                </span>
                <span className="truncate text-xs text-ai-gray-300 sm:text-[13px]">
                  Camera registry + event safety, on one database
                </span>
              </motion.div>

              {/* Headline. Starts at text-4xl so "AI-Powered" fits a 320px
                  screen without hyphenating. */}
              <AnimatedHeroText className="text-shine text-4xl font-bold leading-none tracking-tight xs:text-5xl sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl">
                AI-Powered Event Safety
              </AnimatedHeroText>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="max-w-xl text-base font-light leading-relaxed text-ai-gray-400 sm:text-lg md:text-xl"
              >
                Predict risks. Detect emergencies. Coordinate responses.
                {/* Break only where there's room for two balanced lines */}
                <br className="hidden sm:inline" />{' '}
                Advanced AI for large-scale public safety.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start"
              >
                <HeroButtonExpandable
                  onClick={() => navigate('/register')}
                  variant="primary"
                  expandedContent={
                    <div className="text-sm">
                      <div className="mb-2 font-semibold text-text-primary">Start Free Demo</div>
                      <p className="text-text-tertiary">Experience full platform capabilities</p>
                    </div>
                  }
                >
                  Start Demo
                </HeroButtonExpandable>

                <motion.button
                  onClick={() => goto('pipeline')}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg border border-ai-gray-700 px-6 py-3.5 text-sm font-medium text-ai-gray-200 transition-colors duration-300 hover:border-ai-gray-500 hover:text-ai-white sm:w-auto sm:px-8 sm:py-4 sm:text-base"
                >
                  See the pipeline
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </motion.button>
              </motion.div>

              {/* Live status rail */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="edge-card glassmorphism flex flex-col gap-3 rounded-xl border border-ai-gray-800 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5"
              >
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                  </span>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-ai-white">AI Systems Active</div>
                    <div className="text-xs text-ai-gray-400">6 Models Online</div>
                  </div>
                </div>

                <div className="hidden h-8 w-px bg-ai-gray-800 sm:block" />

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ai-gray-400">
                  <span className="flex items-center gap-1.5">
                    <CircleDot className="h-3 w-3 text-ai-gray-500" />
                    Crowd flow prediction
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CircleDot className="h-3 w-3 text-ai-gray-500" />
                    Anomaly detection
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CircleDot className="h-3 w-3 text-ai-gray-500" />
                    Emergency response
                  </span>
                </div>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="grid grid-cols-3 gap-3 border-t border-border-subtle pt-6 sm:gap-6 sm:pt-8"
              >
                {[
                  { value: '15-20min', label: 'Early Warning' },
                  { value: '99.8%', label: 'Detection Rate' },
                  { value: '<30sec', label: 'Response Time' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + index * 0.1 }}
                  >
                    {/* Values like "15-20min" need to shrink to fit three
                        columns across a 320px viewport */}
                    <div className="tabular mb-1 whitespace-nowrap text-lg font-bold text-ai-white xs:text-xl sm:text-2xl md:text-3xl">
                      {stat.value}
                    </div>
                    <div className="text-xs font-light text-ai-gray-500 sm:text-sm">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right: the instrument. Shorter on phones so the hero copy above
                it still fits the first screen; hidden entirely in landscape
                where vertical space is the scarce resource. */}
            <div className="relative h-[280px] short:hidden sm:h-[400px] lg:h-[600px] lg:short:block">
              <OrbitHud />
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-10 w-6 justify-center rounded-full border-2 border-text-tertiary/30 pt-2"
          >
            <motion.div
              className="h-2 w-1 rounded-full bg-text-tertiary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================
          STACK TICKER
          ================================================================ */}
      <section className="relative z-10 border-y border-ai-gray-900 bg-ai-black/40 py-5 backdrop-blur-sm">
        <div className="page-container mb-3">
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-ai-gray-600">
            Running on
          </p>
        </div>
        <TechMarquee items={STACK} />
      </section>

      {/* ================================================================
          01 — CAPABILITIES
          ================================================================ */}
      <section id="capabilities" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 text-center sm:mb-16">
            <SectionLabel index="01">Six Core Capabilities</SectionLabel>

            <h2 className="mt-6 text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">Comprehensive Safety</span>
              <br />
              <span className="text-recede">Infrastructure</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              Six integrated AI systems working together to ensure complete event oversight — each
              one wired to the same detection stream, the same database and the same set of cameras.
            </p>
          </div>

          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {CAPABILITIES.map((capability, index) => (
              <motion.div
                key={capability.title}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <FeatureCard
                  icon={capability.icon}
                  title={capability.title}
                  description={capability.description}
                  points={capability.points}
                  metric={capability.metric}
                  index={String(index + 1).padStart(2, '0')}
                  delay={0}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          02 — PIPELINE
          ================================================================ */}
      <section id="pipeline" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 max-w-3xl sm:mb-16">
            <SectionLabel index="02">Frame to dispatch</SectionLabel>

            <h2 className="mt-6 text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">One path from a photon</span>
              <br />
              <span className="text-recede">to a unit on the ground</span>
            </h2>
            <p className="mt-4 text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              Seven stages, each owned by a component you can open in the repository. Nothing in
              this diagram is a metaphor — the names below are the modules that run.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
            <PipelineFlow steps={PIPELINE} />

            {/* Aside: the contract, and the loop that runs beside all of it */}
            <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <div className="edge-card overflow-hidden rounded-xl">
                <div className="terminal-surface rounded-xl">
                  <div className="flex items-center gap-2 border-b border-ai-gray-800 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-800" />
                    <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-800" />
                    <span className="ml-2 text-[11px] text-ai-gray-500">
                      ai-service/contracts.py
                    </span>
                  </div>
                  <pre className="table-scroll px-4 py-4">
                    <code>
                      <span className="tok-dim">{'{'}</span>
                      {'\n  '}
                      <span className="tok-key">"cameraId"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-str">"GNR-014"</span>
                      <span className="tok-dim">,</span>
                      {'\n  '}
                      <span className="tok-key">"ts"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-str">"2026-09-10T11:04:22.310Z"</span>
                      <span className="tok-dim">,</span>
                      {'\n  '}
                      <span className="tok-key">"trackId"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-num">42</span>
                      <span className="tok-dim">,</span>
                      {'\n  '}
                      <span className="tok-key">"class"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-str">"car"</span>
                      <span className="tok-dim">,</span>
                      {'\n  '}
                      <span className="tok-key">"confidence"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-num">0.91</span>
                      <span className="tok-dim">,</span>
                      {'\n  '}
                      <span className="tok-key">"attributes"</span>
                      <span className="tok-dim">: {'{'} </span>
                      <span className="tok-key">"plateText"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-str">"GJ01AB1234"</span>
                      <span className="tok-dim"> {'}'},</span>
                      {'\n  '}
                      <span className="tok-key">"zoneOccupancy"</span>
                      <span className="tok-dim">: {'{'} </span>
                      <span className="tok-key">"&lt;zone-uuid&gt;"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-num">14</span>
                      <span className="tok-dim"> {'}'},</span>
                      {'\n  '}
                      <span className="tok-key">"snapshotPath"</span>
                      <span className="tok-dim">: </span>
                      <span className="tok-str">"/snapshots/GNR-014/…jpg"</span>
                      {'\n'}
                      <span className="tok-dim">{'}'}</span>
                    </code>
                  </pre>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-ai-gray-500">
                Both halves of the system compile against this shape. A field with no measured value
                is <code className="text-ai-gray-300">null</code>, never a plausible default.
              </p>

              <div className="edge-card glassmorphism rounded-xl border border-ai-gray-800 p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-ai-white" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-ai-white">
                    Running beside all of it
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-ai-gray-400">
                  Every 30 seconds the health poller opens a socket to each camera, speaks RTSP
                  <code className="mx-1 text-ai-gray-300">OPTIONS</code> then
                  <code className="mx-1 text-ai-gray-300">DESCRIBE</code>, and writes the result.
                  A transition to offline raises its own incident — so a blind camera is an event,
                  not a silence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          03 — ROLES
          ================================================================ */}
      <section id="roles" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 text-center sm:mb-16">
            <SectionLabel index="03">Four audiences, one login</SectionLabel>

            <h2 className="mx-auto mt-6 max-w-3xl text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">Every role gets its own app,</span>{' '}
              <span className="text-recede">and its own limits</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              What you can reach is decided on the server and enforced again in the browser. These
              are the real routes, not a marketing sitemap.
            </p>
          </div>

          <RoleTabs roles={ROLES} onOpen={() => navigate('/login')} />
        </div>
      </section>

      {/* ================================================================
          04 — PROOF
          ================================================================ */}
      <section id="proof" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 max-w-3xl sm:mb-16">
            <SectionLabel index="04">Measured, not claimed</SectionLabel>

            <h2 className="mt-6 text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">If a number reaches you,</span>
              <br />
              <span className="text-recede">something measured it</span>
            </h2>
            <p className="mt-4 text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              The figures below were taken on a development machine — CPU only, no GPU, remote
              database. They are floor values, not headline values.
            </p>
          </div>

          {/* Measured numbers */}
          <div className="edge-card glassmorphism mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ai-gray-800 bg-ai-gray-800/60 sm:mb-8 lg:grid-cols-4">
            {[
              { value: <CountUp to={56} />, unit: 'cameras', label: 'probed over real sockets' },
              {
                value: <CountUp to={1.48} decimals={2} />,
                unit: 'seconds',
                label: 'to sweep all 56, after batching',
              },
              {
                value: <CountUp to={437} />,
                unit: 'ms',
                label: 'vehicle trail across four cameras',
              },
              { value: <span className="tabular">0</span>, unit: 'invented', label: 'values in the source, down from 76' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="bg-ai-black/70 p-5 sm:p-6"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-ai-white sm:text-3xl md:text-4xl">
                    {stat.value}
                  </span>
                  <span className="text-xs text-ai-gray-500 sm:text-sm">{stat.unit}</span>
                </div>
                <div className="mt-2 text-xs leading-relaxed text-ai-gray-400 sm:text-sm">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* The guard */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className="edge-card flex flex-col overflow-hidden rounded-2xl"
            >
              <div className="terminal-surface flex-1 rounded-2xl p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-[11px] text-ai-gray-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-800" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ai-gray-800" />
                  <span className="ml-2">verify</span>
                </div>
                <pre className="table-scroll leading-relaxed">
                  <code>
                    <span className="tok-dim">$ </span>
                    <span className="tok-str">npm run verify</span>
                    {'\n\n'}
                    <span className="tok-ok">✓</span>
                    <span className="tok-dim"> type-check </span>
                    <span className="tok-key">backend</span>
                    {'\n'}
                    <span className="tok-ok">✓</span>
                    <span className="tok-dim"> type-check </span>
                    <span className="tok-key">frontend</span>
                    {'\n'}
                    <span className="tok-ok">✓</span>
                    <span className="tok-dim"> fabrication guard </span>
                    <span className="tok-key">PASS</span>
                    <span className="tok-dim"> — 0 invented values</span>
                    {'\n'}
                    <span className="tok-dim">                     (3 allowlisted: particles,</span>
                    {'\n'}
                    <span className="tok-dim">                      id generation, one filename)</span>
                  </code>
                </pre>
              </div>
            </motion.div>

            {/* What is not built */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="edge-card glassmorphism rounded-2xl border border-ai-gray-800 p-5 sm:p-8"
            >
              <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-ai-white sm:text-xl">
                What is not built
              </h3>
              <p className="mb-5 text-sm text-ai-gray-500">
                Stated plainly, because a system that omits its gaps cannot be audited.
              </p>

              <ul className="space-y-4">
                {NOT_BUILT.map((item) => (
                  <li key={item.title} className="flex gap-3 border-b border-ai-gray-900 pb-4 last:border-0 last:pb-0">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ai-gray-600" />
                    <div>
                      <div className="text-sm font-medium text-ai-gray-200">{item.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-ai-gray-500 sm:text-sm">
                        {item.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* The rule itself */}
          <motion.blockquote
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-6 rounded-2xl border-l-2 border-ai-white bg-ai-gray-900/40 p-5 sm:mt-8 sm:p-8"
          >
            <p className="text-base font-light leading-relaxed text-ai-gray-200 sm:text-lg md:text-xl">
              “Every number a user sees is derived from a real detection, a real database row, or a
              real computation. Where a real value does not exist yet, the interface says so.”
            </p>
            <footer className="mt-3 text-xs uppercase tracking-[0.16em] text-ai-gray-600">
              The rule the architecture is built around
            </footer>
          </motion.blockquote>
        </div>
      </section>

      {/* ================================================================
          05 — FAQ
          ================================================================ */}
      <section id="faq" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <SectionLabel index="05">Questions</SectionLabel>
              <h2 className="mt-6 text-2xl font-bold tracking-tight xs:text-3xl md:text-4xl">
                <span className="text-ai-white">The answers</span>
                <br />
                <span className="text-recede">an operator asks for</span>
              </h2>
              <p className="mt-4 text-sm font-light text-ai-gray-400 sm:text-base">
                Deployment, degradation, scale and access — the four things that decide whether a
                safety system survives contact with a real venue.
              </p>
            </div>

            <FaqAccordion items={FAQ} />
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA
          ================================================================ */}
      <section className="relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: '-100px' }}
            className="edge-card group glassmorphism relative overflow-hidden rounded-2xl border border-ai-gray-800 p-6 sm:p-10 md:p-16"
            whileHover={{ scale: 1.01 }}
          >
            {/* Animated background gradient on hover */}
            <motion.div
              className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 0%, transparent 70%)',
              }}
            />

            {/* Accent line */}
            <div className="absolute left-1/2 top-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-ai-white to-transparent" />

            <div className="relative z-10">
              <motion.h3
                className="mb-4 text-2xl font-bold tracking-tight text-ai-white xs:text-3xl sm:mb-6 md:text-4xl"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
              >
                Ready to Transform
                <br />
                Event Safety?
              </motion.h3>

              <motion.p
                className="mx-auto mb-8 max-w-2xl text-sm font-light text-ai-gray-400 sm:mb-10 sm:text-base md:text-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
              >
                Join the future of AI-powered event management.
                <br className="hidden md:block" />
                Protect your attendees with cutting-edge technology.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
                className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
              >
                <GradientButton
                  onClick={() => navigate('/register')}
                  variant="primary"
                  className="flex w-full items-center justify-center gap-2 text-sm !px-6 !py-3.5 sm:w-auto sm:text-base sm:!px-10 sm:!py-4"
                >
                  Get Started Now <ArrowRight className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                </GradientButton>
                <GradientButton
                  onClick={() => navigate('/login')}
                  variant="ghost"
                  className="w-full text-sm !px-6 !py-3.5 sm:w-auto sm:text-base sm:!px-10 sm:!py-4"
                >
                  Sign in
                </GradientButton>
              </motion.div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ai-gray-500">
                {[
                  'Privacy-first by design',
                  'Works with existing RTSP cameras',
                  'Degrades honestly, never silently',
                ].map((chip) => (
                  <span key={chip} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ai-gray-500" strokeWidth={1.5} />
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-ai-white to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="safe-bottom relative z-10 border-t border-ai-gray-900 pt-12 sm:pt-16">
        <div className="page-container">
          <div className="grid gap-8 pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ai-white">
                  <span className="text-lg font-bold text-ai-black">&#10022;</span>
                </span>
                <span className="text-xl font-bold tracking-tight">Drishti</span>
              </div>
              <p className="max-w-xs text-sm font-light leading-relaxed text-ai-gray-500">
                A camera registry that stands on its own, and an event-safety layer that borrows
                from it. One database, one authentication system, one set of cameras.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.18em] text-ai-gray-600">
                Platform
              </h4>
              <ul className="space-y-2.5">
                {NAV_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => goto(section.id)}
                      className="text-sm text-ai-gray-400 transition-colors hover:text-ai-white"
                    >
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.18em] text-ai-gray-600">
                Consoles
              </h4>
              <ul className="space-y-2.5">
                {ROLES.map((role) => (
                  <li key={role.id}>
                    <button
                      onClick={() => navigate('/login')}
                      className="text-sm text-ai-gray-400 transition-colors hover:text-ai-white"
                    >
                      {role.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.18em] text-ai-gray-600">
                Get started
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <button
                    onClick={() => navigate('/register')}
                    className="text-sm text-ai-gray-400 transition-colors hover:text-ai-white"
                  >
                    Create an account
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-sm text-ai-gray-400 transition-colors hover:text-ai-white"
                  >
                    Sign in
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate('/explore-events')}
                    className="text-sm text-ai-gray-400 transition-colors hover:text-ai-white"
                  >
                    Explore events
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-ai-gray-900 py-6 sm:flex-row">
            <p className="text-xs font-light text-ai-gray-600 sm:text-sm">
              © 2025 Drishti. Built for hackathon demonstration. Privacy-first design.
            </p>
            <p className="text-xs text-ai-gray-700">
              Gujarat Police Innovation Challenge 2026 · Model 1 + event safety
            </p>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            whileHover={{ y: -3 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="glassmorphism-strong fixed bottom-6 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-ai-gray-700 text-ai-gray-200 shadow-strong transition-colors hover:text-ai-white sm:right-6"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Back to top"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Landing;
