// Render API
export {render, renderToString, measureElement, patchConsole} from './render/index.js';
export type {RenderOptions, Instance} from './render/types.js';

// Hooks
export {useInput, useApp, useStdin, useFocus, useFocusManager} from './hooks/index.js';
export type {Key} from './hooks/types.js';

// Components
export {Box, Text, Newline, Spacer, Transform, Static} from './components/index.js';
export type {BoxProps, TextProps, NewlineProps, TransformProps, StaticProps} from './components/index.js';

// Types (re-export useful DOM types for measureElement refs)
export type {DOMElement} from './dom/types.js';
