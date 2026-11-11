// The one thing to do. Every picture offers the five ways to go and exactly one of these; which one, the model
// says. A big model is asked for the action itself, a small one for the thing that goes with it (measured: the
// small one knows what it sees far better than what to do about it).
export interface Action {
  id: string
  action: string // what the person is told
  thing: string // what has to be in the picture
}

export const ACTIONS: Action[] = [
  { id: 'photo', action: 'Take a photo', thing: 'a church, tower, monument or view' },
  { id: 'sit', action: 'Sit down', thing: 'a bench or chair' },
  { id: 'inside', action: 'Go inside', thing: 'a door or entrance' },
  { id: 'talk', action: 'Talk to someone', thing: 'people' },
  { id: 'window', action: 'Look out of the window', thing: 'a window' },
  { id: 'coffee', action: 'Have a coffee', thing: 'a cafe or restaurant' },
  { id: 'tram', action: 'Take the next tram', thing: 'a tram or bus stop' },
  { id: 'read', action: 'Read what it says', thing: 'a sign, poster or plaque' },
  { id: 'water', action: 'Go to the water', thing: 'water: a river, fountain or sea' },
  { id: 'stairs', action: 'Climb the stairs', thing: 'stairs' },
]

export const DIRECTIONS = ['Stand here', 'Left', 'Right', 'Up', 'Down']
export const ASK_ACTION = 'What is the one thing worth doing here?'
export const ASK_THING = 'Which of these things can be seen in this photo?'
export const ASK_DECISION = 'Looking at this photo, what should the person do next?'
