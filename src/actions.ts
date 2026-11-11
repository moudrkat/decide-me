// The one thing to do. Every picture offers the five ways to go and exactly one of these; which one, the model
// says. The list, the wording and the numbers below come from 672 photos of 56 kinds of places (streets, stops,
// kitchens, museums…), each kind with the actions a person would accept written down beforehand.
export interface Action {
  id: string
  action: string // what the person is told
  thing: string // what has to be in the picture
  prior: number // how readily the small model names this thing whatever the picture shows (mean over the 672)
}

export const ACTIONS: Action[] = [
  { id: 'photo', action: 'Take a photo', thing: 'a church, tower, monument or view', prior: 0.000138 },
  { id: 'sit', action: 'Sit down', thing: 'a bench or chair', prior: 0.000331 },
  { id: 'inside', action: 'Go inside', thing: 'a door or entrance', prior: 0.000103 },
  { id: 'talk', action: 'Talk to someone', thing: 'people', prior: 0.00432 },
  { id: 'window', action: 'Look out of the window', thing: 'a window', prior: 0.000116 },
  { id: 'coffee', action: 'Have a coffee', thing: 'a cafe', prior: 3.56e-5 },
  { id: 'tram', action: 'Take the next tram', thing: 'a tram, bus or train stop', prior: 1.38e-6 },
  { id: 'read', action: 'Read what it says', thing: 'a sign, poster or plaque', prior: 1.67e-6 },
  { id: 'water', action: 'Go to the water', thing: 'water: a river, fountain or sea', prior: 5.96e-6 },
  { id: 'stairs', action: 'Climb the stairs', thing: 'stairs', prior: 7.79e-5 },
  { id: 'dog', action: 'Pet the dog', thing: 'a dog', prior: 9.74e-7 },
  { id: 'flowers', action: 'Smell the flowers', thing: 'flowers', prior: 3.87e-6 },
  { id: 'bridge', action: 'Cross the bridge', thing: 'a bridge', prior: 1.91e-6 },
  { id: 'listen', action: 'Stop and listen', thing: 'a musician', prior: 1.68e-5 },
  { id: 'books', action: 'Open a book', thing: 'books', prior: 3.34e-6 },
  { id: 'play', action: 'Go on the swing', thing: 'a playground', prior: 1.87e-5 },
  { id: 'outside', action: 'Go outside', thing: 'an exit', prior: 5.75e-6 },
  { id: 'eat', action: 'Eat something', thing: 'food', prior: 1.55e-6 },
  { id: 'buy', action: 'Buy something small', thing: 'a shop counter or stall', prior: 2.45e-6 },
  { id: 'lie', action: 'Lie down', thing: 'a bed or sofa', prior: 3.37e-6 },
  { id: 'tea', action: 'Make a tea', thing: 'a kitchen', prior: 5.43e-5 },
  { id: 'work', action: 'Get back to work', thing: 'a desk or computer', prior: 4.95e-6 },
  { id: 'art', action: 'Look at the art', thing: 'a painting or exhibit', prior: 7.46e-6 },
  { id: 'hands', action: 'Wash your hands', thing: 'a sink', prior: 2.53e-6 },
]

export const DIRECTIONS = ['Stand here', 'Left', 'Right', 'Up', 'Down']
export const ASK_THING = 'Which of these things can be seen in this photo?'
export const ASK_DECISION = 'Looking at this photo, what should the person do next?'
