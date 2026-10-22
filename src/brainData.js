export const regions = [
  {
    id: 'cortex', name: 'Cerebral hemispheres', short: 'Distributed processing',
    category: 'Integration', computer: 'Parallel processors',
    description: 'The left and right cerebral hemispheres each contain many specialized, interconnected networks. They cooperate through large fiber pathways.',
    analogy: 'Think of many processors coordinating, not one CPU on the left and one GPU on the right.',
    boundary: 'No hemisphere is exclusively logical, creative, CPU-like, or GPU-like.',
    position: [0, 0.37, 0], radius: 0.19, color: '#78b8e5'
  },
  {
    id: 'prefrontal', name: 'Prefrontal networks', short: 'Planning & control',
    category: 'Executive', computer: 'CPU / scheduler analogy',
    description: 'Prefrontal circuits contribute to planning, attention, working-memory control, and flexible decision-making in concert with other regions.',
    analogy: 'A scheduler or CPU orchestrating tasks is a useful metaphor for executive control.',
    boundary: 'Executive functions do not live in a single CPU-shaped location.',
    position: [0, 0.36, 0.85], radius: 0.19, color: '#e7b76e'
  },
  {
    id: 'visual', name: 'Visual cortex', short: 'Seeing & imagining',
    category: 'Perception', computer: 'GPU analogy',
    description: 'Occipital and connected visual networks analyze visual signals; many of these circuits also contribute to visual mental imagery.',
    analogy: 'The GPU comparison points to intensive visual and spatial computation.',
    boundary: 'Imagery uses wider networks; there is no literal pixel buffer or graphics card in the brain.',
    position: [0, 0.35, -0.92], radius: 0.21, color: '#ae9bf7'
  },
  {
    id: 'parietal', name: 'Frontoparietal networks', short: 'Spatial working memory',
    category: 'Cognition', computer: 'RAM / active workspace',
    description: 'Frontal and parietal networks help maintain and manipulate information over short periods, including spatial relationships and mental rotation.',
    analogy: 'Working memory has RAM-like properties: information is actively held and updated.',
    boundary: 'Working memory is distributed activity, not a physical RAM stick or the pineal gland.',
    position: [0.36, 0.77, -0.12], radius: 0.18, color: '#6dd9c5'
  },
  {
    id: 'hippocampus', name: 'Hippocampal system', short: 'Memory formation',
    category: 'Memory', computer: 'Index & archive coordinator',
    description: 'The hippocampus is important for forming and retrieving episodic memories, interacting with distributed cortical memory representations.',
    analogy: 'More like an indexing and consolidation partner than a hard drive containing all memories.',
    boundary: 'Memories are not stored as files in one anatomical folder.',
    position: [-0.38, -0.32, -0.17], radius: 0.16, color: '#f0a2a9'
  },
  {
    id: 'thalamus', name: 'Thalamus', short: 'Relay & coordination',
    category: 'Connectivity', computer: 'Router / signal hub',
    description: 'The thalamus participates in sensory relay and coordination among cortical and subcortical networks.',
    analogy: 'A routing hub can help explain some thalamic functions.',
    boundary: 'It is not merely a passive wire-switch or universal traffic controller.',
    position: [0, -0.2, 0.04], radius: 0.21, color: '#f1c784'
  },
  {
    id: 'pineal', name: 'Pineal gland', short: 'Melatonin & body clock',
    category: 'Timing', computer: 'Clock / timing signal',
    description: 'The pineal gland secretes melatonin and participates in circadian and seasonal timing through signals from the brain’s clock system.',
    analogy: 'A time-of-day signaling component is a better computer comparison than RAM.',
    boundary: 'The pineal gland is not established as a memory store, CPU, GPU, or special visual renderer.',
    position: [0, 0.15, -0.35], radius: 0.11, color: '#ffcf83'
  },
  {
    id: 'cerebellum', name: 'Cerebellum', short: 'Coordination & prediction',
    category: 'Control', computer: 'Real-time feedback controller',
    description: 'The cerebellum contributes to movement coordination, predictive control, learning, and some cognitive processes.',
    analogy: 'A real-time controller continuously refining predictions is a useful comparison.',
    boundary: 'Its contribution is broader than controlling physical movement alone.',
    position: [0, -0.86, -0.62], radius: 0.3, color: '#7fbbe5'
  },
  {
    id: 'brainstem', name: 'Brainstem', short: 'Vital regulation',
    category: 'Autonomic', computer: 'Core services',
    description: 'Brainstem structures contribute to breathing, cardiovascular regulation, arousal, and many essential pathways.',
    analogy: 'Always-on system services suggests the importance of these vital circuits.',
    boundary: 'Brainstem functions cannot be reduced to an on/off power switch.',
    position: [0, -1.02, 0.08], radius: 0.2, color: '#85c5ab'
  },
  {
    id: 'callosum', name: 'Corpus callosum', short: 'Interhemispheric links',
    category: 'Connectivity', computer: 'High-bandwidth interconnect',
    description: 'A large tract of nerve fibers connects the hemispheres and supports exchange of information.',
    analogy: 'An interconnect is a helpful comparison for communication between distributed processors.',
    boundary: 'The two sides do not form isolated computer chips.',
    position: [0, 0.12, 0.17], radius: 0.14, color: '#d6a9eb'
  }
];

export const byId = Object.fromEntries(regions.map((region) => [region.id, region]));

export const modes = {
  anatomy: {
    name: 'Anatomy atlas',
    heading: 'Explore the connected brain',
    description: 'Select a network. Rotate the schematic brain and expand the layers to inspect their relationships.'
  },
  analogy: {
    name: 'Computer analogy',
    heading: 'Brain ≠ motherboard',
    description: 'Map familiar computing ideas onto distributed biology, then inspect where each comparison breaks down.'
  },
  cfd: {
    name: 'CFD workshop',
    heading: 'Mental rotation laboratory',
    description: 'A conceptual exploded-view object illustrates visual-spatial manipulation. This depicts an idea, not a scan of anyone’s mind.'
  }
};

export const links = [
  ['prefrontal', 'parietal'], ['parietal', 'visual'], ['hippocampus', 'prefrontal'],
  ['hippocampus', 'thalamus'], ['thalamus', 'cortex'], ['thalamus', 'brainstem'],
  ['visual', 'cerebellum'], ['cerebellum', 'brainstem'], ['callosum', 'cortex'],
  ['pineal', 'thalamus'], ['prefrontal', 'callosum']
];
