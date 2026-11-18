// A stage: what one root view shares with its nested views (the map windows, the ground's light, the readout).
// A nested view is given the stage's number, and reads the stage each time it draws.
import { SIDEBAR_COLORS as C } from "../vocabulary.js";

const stages = new Map();
let count = 0;

/** A new stage and its number: `[id, stage]`. The owner writes the stage; nested views only read it. */
export function openStage() {
	const stage = {
		world: null, // the map's world, from map.js's buildWorld
		watch: null, // the unit under the plate's crosshair
		hover: null, hoverTab: null, // the unit and the tab under the pointer
		viewW: 264, width: 300, // a map window's width; the plate's
		ground: C.groundBottom, // the ground a map window dissolves into
		size: null, pointer: null, // the list's size and the pointer over it, for the ground's light
		readout: null, readAt: 0, // the scanner's readout { text, color } and when it started
	};
	stages.set(++count, stage);
	return [count, stage];
}
export const stageOf = (id) => stages.get(id);
