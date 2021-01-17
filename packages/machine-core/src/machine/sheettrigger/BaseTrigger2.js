/********************************************************************************
 * Copyright (c) 2020 Cedalo AG
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 ********************************************************************************/
const DEF_CONF = {
	repeat: 'once'
};

class BaseTrigger2 {
	constructor(config = {}) {
		this.config = Object.assign({}, DEF_CONF, config);
		this._streamsheet = undefined;
	}

	toJSON() {
		return Object.assign({}, this.config);
	}

	get type() {
		return this.config.type;
	}

	get isEndless() {
		return this.config.repeat === 'endless';
	}

	get sheet() {
		return this._streamsheet.sheet;
	}

	get streamsheet() {
		return this._streamsheet;
	}

	set streamsheet(streamsheet) {
		this._streamsheet = streamsheet;
	}

	// called by streamsheet. signals that it will be removed. trigger should perform clean up here...
	dispose() {
		if (this.sheet.isPaused) this.resumeProcessing();
		this.stopProcessing();
		this._streamsheet = undefined;
	}

	update(config = {}) {
		this.config = Object.assign(this.config, config);
		// if (!this.isEndless && clearTrigger(this)) this.resume();
	}

	// CONTROL METHODS
	pause() {
		// clearTrigger(this);
	}

	resume() { // called by machine resume, i.e. from pause to start
		// if sheet is not stopped or paused by function 
		if (!this.isStopped && !this.sheet.isPaused) {
			if (this.isEndless) this._finishRepeatStep();
			else this._finishStep();
		}
		this.isStopped = false;
	}

	start() {
		// reset stats?
	}
	stop() {
		this.stopProcessing();
		return true;
	}
	stopProcessing(retval) {
		clearTrigger(this);
		this.isStopped = true;
		this._streamsheet.stats.repeatsteps = 0;
		this.sheet._stopProcessing(retval);
	}
	pauseProcessing() {
		clearTrigger(this);
		this.sheet._pauseProcessing();
	}
	resumeProcessing(retval) {
		if (this.sheet.isPaused) {
			this.isResumed = true;
			this.sheet._resumeProcessing(retval);
			if (!this.isManualStep && this.isEndless) this._finishRepeatStep();
			else this._finishStep();
		}
	}
	_finishStep() {
		if (!this.sheet.isProcessed) this._streamsheet.triggerStep();
	}
	_finishRepeatStep() {
		// if (!this.sheet.isProcessed) this._streamsheet.triggerStep();
		this._finishStep();
		if (!this.sheet.isPaused) repeatTrigger(this);
	}

	preStep(manual) {
		this.isResumed = false;
		this.isManualStep = manual;
	}
	step(/* manual */) {}
	postStep(/* manual */) {
		this.isManualStep = false;
	}

	_startRepeat() {
		repeatTrigger(this);
		this._streamsheet.stats.steps += 1;
		// on repeat start we do a normal cycle!
		this.doCycleStep();
	}
	_repeatStep() {
		repeatTrigger(this);
		// trigger step afterwards, because it might clears current scheduled one!!!
		this.doRepeatStep();
	}
	trigger() {
		if (!this.isResumed && this._stepId == null) {
			// do not start repetition again if isPaused by function!
			if (!this.isManualStep && this.isEndless && !this.sheet.isPaused) this._startRepeat();
			else this.doCycleStep();
		}
	}
	doCycleStep() {
		// we come here on manual step for repeating too, so:
		if (!this.sheet.isPaused) {
			if (this.isEndless) {
				this._streamsheet.stats.repeatsteps += 1;
				if (this.isManualStep) this._streamsheet.stats.steps += 1;
			} else {
				this._streamsheet.stats.steps += 1;
			}
		}
		this._streamsheet.triggerStep();
	}
	doRepeatStep() {
		this._streamsheet.stats.repeatsteps += 1;
		this._streamsheet.triggerStep();
	}
}

module.exports = BaseTrigger2;