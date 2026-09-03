import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  CalendarPlus,
  Users,
  AlertTriangle,
  MapPin,
  Megaphone,
  FileText,
  ClipboardList,
  Activity,
  HeartPulse,
  Layers,
  Lock,
  ShieldCheck,
  PlugZap,
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
import StepFlow, { FlowStep } from '../components/landing/StepFlow';
import RoleTabs, { RoleDefinition } from '../components/landing/RoleTabs';
import FaqAccordion, { FaqItem } from '../components/landing/FaqAccordion';
import OrbitHud from '../components/landing/OrbitHud';

/* ---------------------------------------------------------------------------
   Page copy. Kept out of the component so the markup stays readable — and in
   one place, so it can be read straight through as the sentences a visitor
   will actually meet. Written for someone deciding whether to trust this with
   a crowd, not for someone reading the repository.
   --------------------------------------------------------------------------- */

const NAV_SECTIONS: NavSection[] = [
  { id: 'capabilities', label: 'What it does' },
  { id: 'how', label: 'How it works' },
  { id: 'roles', label: "Who it's for" },
  { id: 'faq', label: 'FAQ' },
];

const WATCHES_FOR = [
  'Crowds building at a stage',
  'Queues at the gates',
  'Areas past their safe limit',
  'Sudden surges',
  'Blocked exits',
  'Falls and injuries',
  'Fires',
  'Medical emergencies',
];

const CAPABILITIES = [
  {
    icon: CalendarPlus,
    title: 'Set up an event in minutes',
    description:
      'Say where it is and when, mark the areas that matter — the stage, the gates, the food court — and publish it so people can find it and sign up.',
    metric: { value: 'Minutes', label: 'to go live' },
  },
  {
    icon: Users,
    title: 'See crowds building early',
    description:
      'You are told an area is filling up 15 to 20 minutes before it becomes a crush, with the exact spot on your venue map.',
    metric: { value: '15-20 min', label: 'early warning' },
  },
  {
    icon: AlertTriangle,
    title: 'Spot trouble the moment it starts',
    description:
      'Falls, fires and sudden surges are flagged as they happen, so nobody has to be staring at the right screen at the right second.',
    metric: { value: 'Seconds', label: 'to spot it' },
  },
  {
    icon: MapPin,
    title: 'Send help without the phone tag',
    description:
      'The nearest marshal or medic gets the incident, the location and the details in one tap. No radio relay, no repeating yourself.',
    metric: { value: 'One tap', label: 'to send help' },
  },
  {
    icon: Megaphone,
    title: 'Keep your attendees in the loop',
    description:
      'The people who signed up get live updates about your event on their own phone, and emergency contacts are always one tap away.',
    metric: { value: 'Everyone', label: 'kept informed' },
  },
  {
    icon: FileText,
    title: 'Finish with a report, not a memory',
    description:
      'When it is over you get a write-up of how the day went and every incident in it. You can also just ask, in plain English, what happened at eight o’clock.',
    metric: { value: 'Same day', label: 'full report' },
  },
];

const HOW_IT_WORKS: FlowStep[] = [
  {
    icon: CalendarCheck,
    title: 'Set up your event',
    description:
      'Tell Drishti where it is, when it is, and mark out the areas that matter — the stage, the gates, the food court. Publish it, and people can find your event and sign up. That is the whole setup.',
  },
  {
    icon: Activity,
    title: 'Watch it as it happens',
    description:
      'Once the doors open you get a live picture of how full each area is, and a warning when one starts heading the wrong way — early enough to open another exit rather than call an ambulance. It reads this from the cameras the venue already has.',
  },
  {
    icon: ClipboardList,
    title: 'Close it out',
    description:
      'When the event ends you get the report: how the crowd moved through the day, every incident, and what was done about each one. Hand it to whoever needs it.',
  },
];

const ROLES: RoleDefinition[] = [
  {
    id: 'organizer',
    label: 'Event organizers',
    icon: Layers,
    headline: 'Run the event, not the panic',
    summary:
      'Everything from planning the venue to the report you send afterwards. Set up your areas, watch the crowd as it moves, deal with incidents while they are still small, and finish with a record of what actually happened.',
    abilities: [
      'Set up your event and mark out your venue',
      'Watch crowd levels area by area',
      'Get early warnings before an area fills up',
      'Handle incidents and request help',
      'Ask questions about your event in plain English',
      'Download a report when it is over',
    ],
    privacy:
      'You see your own events and nobody else’s, and only for as long as they are yours.',
  },
  {
    id: 'safety',
    label: 'Safety teams',
    icon: HeartPulse,
    headline: 'Everyone on the ground sees the same thing',
    summary:
      'Marshals, medics and security stop working from second-hand radio traffic. The same live picture the organizer has, on the phone in their pocket, with the incidents that are actually theirs.',
    abilities: [
      'The live crowd picture for the event you are working',
      'Incidents as they are raised, with the exact location',
      'Be sent to the right place instead of the general area',
      'Mark an incident as being dealt with, and as done',
      'Early warnings before an area becomes a problem',
    ],
    privacy:
      'This access is granted by an administrator, never signed up for, and every action is checked against the role that was given.',
  },
  {
    id: 'participant',
    label: 'Attendees',
    icon: Users,
    headline: 'Your event, in your pocket',
    summary:
      'People who came to enjoy the event get the event, not a control room. Find something to go to, sign up in seconds, and stay in the loop while you are there.',
    abilities: [
      'Browse and search what is on',
      'Sign up in a couple of taps',
      'Live updates for events you joined',
      'Emergency contacts always one tap away',
      'Directions to the venue',
    ],
    privacy:
      'No camera feeds, no incident lists, and nothing at all about any other attendee.',
  },
  {
    id: 'admin',
    label: 'Administrators',
    icon: Lock,
    headline: 'Decide who sees what',
    summary:
      'Accounts, permissions and oversight in one place — and the only place where someone can be given access to an event’s live view.',
    abilities: [
      'Manage accounts across the platform',
      'Grant and remove access',
      'Keep an eye on every event',
      'A platform-wide overview',
    ],
    privacy:
      'Handing out access is a deliberate act. Nobody can give it to themselves by signing up.',
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: 'It never guesses',
    description:
      'If the system does not know something yet, it says so. You will never be shown a confident-looking number that was invented to fill a gap.',
  },
  {
    icon: Lock,
    title: 'Your attendees are counted, not identified',
    description:
      'Drishti works out how many people are in an area, not who they are. Nobody is named, and what it sees stays inside your own system.',
  },
  {
    icon: PlugZap,
    title: 'Nothing new to buy',
    description:
      'It runs on the cameras the venue already has. No hardware order, no installation day, no six-month project before your first event.',
  },
];

const FAQ: FaqItem[] = [
  {
    question: 'How long does it take to get an event running?',
    answer:
      'Minutes. Create the event, mark out the areas that matter on the map, and publish it. Most organizers do the whole thing in one sitting, without anyone technical in the room.',
  },
  {
    question: 'Does it work for smaller events?',
    answer:
      'Yes. A single stage with a few hundred people works exactly like a stadium with fifty thousand — you mark out fewer areas, and the warnings behave the same. Nothing about it assumes a big budget or a control room.',
  },
  {
    question: 'Do my attendees have to install anything?',
    answer:
      'No. They browse what is on, sign up and get live updates in an ordinary browser, on whatever phone they already carry.',
  },
  {
    question: 'What does my team actually do during the event?',
    answer:
      'Watch one screen and act on what it tells them. Warnings arrive with the location attached, incidents can be sent to the nearest marshal or medic in a tap, and everyone on the ground is looking at the same picture instead of relaying it over radio.',
  },
  {
    question: 'How early are the warnings, really?',
    answer:
      'Typically 15 to 20 minutes before an area becomes dangerously full. That is the difference between calmly opening another exit and calling an ambulance.',
  },
  {
    question: 'What do I get once it is over?',
    answer:
      'A report of how the event went: how the crowd moved through the day, every incident that was raised, and what was done about each one. You can also just ask it questions in plain English rather than reading the whole thing.',
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
                  Plan it, run it safely, report on it
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
                  onClick={() => goto('how')}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg border border-ai-gray-700 px-6 py-3.5 text-sm font-medium text-ai-gray-200 transition-colors duration-300 hover:border-ai-gray-500 hover:text-ai-white sm:w-auto sm:px-8 sm:py-4 sm:text-base"
                >
                  See how it works
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
          WHAT IT WATCHES FOR
          ================================================================ */}
      <section className="relative z-10 border-y border-ai-gray-900 bg-ai-black/40 py-5 backdrop-blur-sm">
        <div className="page-container mb-3">
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-ai-gray-600">
            Watching for
          </p>
        </div>
        <TechMarquee items={WATCHES_FOR} />
      </section>

      {/* ================================================================
          01 — WHAT IT DOES
          ================================================================ */}
      <section id="capabilities" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 text-center sm:mb-16">
            <SectionLabel index="01">What it does</SectionLabel>

            <h2 className="mx-auto mt-6 max-w-3xl text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">Everything your event needs</span>{' '}
              <span className="text-recede">from first plan to final report</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              Six things Drishti does for you, from the day you start planning to the report you
              send after everyone has gone home.
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
          02 — HOW IT WORKS
          ================================================================ */}
      <section id="how" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 sm:mb-16">
              <SectionLabel index="02">How it works</SectionLabel>

              <h2 className="mt-6 text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
                <span className="text-ai-white">Three steps.</span>{' '}
                <span className="text-recede">That is the whole thing.</span>
              </h2>
              <p className="mt-4 text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
                Set it up, watch it, close it out. No control room to build and no training
                course to sit through.
              </p>
            </div>

            <StepFlow steps={HOW_IT_WORKS} />
          </div>
        </div>
      </section>

      {/* ================================================================
          03 — WHO IT IS FOR
          ================================================================ */}
      <section id="roles" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 text-center sm:mb-16">
            <SectionLabel index="03">Who it is for</SectionLabel>

            <h2 className="mx-auto mt-6 max-w-3xl text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">Four very different people,</span>{' '}
              <span className="text-recede">one app</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-light text-ai-gray-400 sm:mt-6 sm:text-base md:text-lg">
              What you see depends entirely on who you are.
            </p>
          </div>

          <RoleTabs roles={ROLES} onOpen={() => navigate('/login')} />
        </div>
      </section>

      {/* ================================================================
          04 — TRUST
          ================================================================ */}
      <section id="trust" className="scroll-anchor relative py-16 sm:py-20 lg:py-28">
        <div className="page-container relative z-10">
          <div className="mb-10 text-center sm:mb-16">
            <SectionLabel index="04">Why you can trust it</SectionLabel>

            <h2 className="mx-auto mt-6 max-w-3xl text-2xl font-bold tracking-tight xs:text-3xl md:text-5xl">
              <span className="text-ai-white">Built to be believed</span>{' '}
              <span className="text-recede">on a bad day</span>
            </h2>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {TRUST.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="edge-card glassmorphism rounded-2xl border border-ai-gray-800 p-6 sm:p-8"
                >
                  <Icon className="mb-5 h-6 w-6 text-ai-white" strokeWidth={1.5} />
                  <h3 className="mb-2.5 text-lg font-semibold tracking-tight text-ai-white">
                    {item.title}
                  </h3>
                  <p className="text-sm font-light leading-relaxed text-ai-gray-400">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <motion.blockquote
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mx-auto mt-6 max-w-3xl rounded-2xl border-l-2 border-ai-white bg-ai-gray-900/40 p-6 sm:mt-8 sm:p-8"
          >
            <p className="text-base font-light leading-relaxed text-ai-gray-200 sm:text-lg md:text-xl">
              “Every number you see comes from something we actually measured. Where we do not have
              a real answer yet, we say so.”
            </p>
            <footer className="mt-3 text-xs uppercase tracking-[0.16em] text-ai-gray-600">
              The rule the whole system is built on
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
                <span className="text-ai-white">The things</span>{' '}
                <span className="text-recede">people actually ask</span>
              </h2>
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
                  'Set up in minutes',
                  'Nothing to install at the venue',
                  'Privacy-first by design',
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
          <div className="grid gap-8 pb-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ai-white">
                  <span className="text-lg font-bold text-ai-black">&#10022;</span>
                </span>
                <span className="text-xl font-bold tracking-tight">Drishti</span>
              </div>
              <p className="max-w-xs text-sm font-light leading-relaxed text-ai-gray-500">
                Event safety from the first plan to the final report, so your team can look
                after the people who came.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-[11px] uppercase tracking-[0.18em] text-ai-gray-600">
                Explore
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
                    Browse events
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-ai-gray-900 py-6 sm:flex-row">
            <p className="text-xs font-light text-ai-gray-600 sm:text-sm">
              © 2025 Drishti. Built for hackathon demonstration. Privacy-first design.
            </p>
            <p className="text-xs text-ai-gray-700">Gujarat Police Innovation Challenge 2026</p>
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
