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
const { FunctionErrors, ErrorInfo } = require('@cedalo/error-codes');

const ERROR = FunctionErrors.code;

const remove = (index, arr) => arr.splice(index, 1)[0];
// const setErrorInfo = (cell, error) => (cell ? cell.setCellInfo('error', error) : undefined);
const setFunctionName = (fn) => (error) => {
	const name = fn && fn.term && fn.term.name;
	return name ? error.setFunctionName(name) : error;
};

class ErrorHandler {
	constructor() {
		this._errorInfo = undefined;
		this._errorCode = undefined;
		this._errorIndex = -1;
		this._ignoreError = false;
	}

	get ignoreError() {
		return this._ignoreError;
	}
	set ignoreError(doIt) {
		this._ignoreError = doIt;
	}

	getError() {
		if (this._errorInfo) {
			return this._errorInfo;
		}
		const error = this._errorCode ? ErrorInfo.create(this._errorCode) : undefined;
		return error && this._errorIndex >= 0 ? error.setParamIndex(this._errorIndex + 1) : error;
	}

	hasError() {
		return (this._errorCode || this._errorInfo) && !this._ignoreError;
	}

	updateORG(res, index) {
		if (res && !this._errorCode) {
			this._errorCode = FunctionErrors.isError(res);
			this._errorIndex = index != null ? index : -1;
		}
	}
	update(res, index) {
		if (res && !this._errorCode) {
			const error = FunctionErrors.isError(res);
			if (error) {
				if (error.isErrorInfo) {
					this._errorInfo = error;
				} else {
					this._errorCode = FunctionErrors.isError(res);
				}
				this._errorIndex = index != null ? index : -1;
			}
		}
	}
}
class Runner {
	constructor(sheet, args, fn) {
		this.sheet = sheet;
		// this.cell = fn && fn.term ? fn.term.cell : undefined;
		this.setFunctionName = setFunctionName(fn);
		// work on copy or not???
		this.args = args ? args.slice(0) : [];
		this.index = 0;
		this.prevArg = undefined;
		this.isEnabled = true;
		this.defReturnValue = true;
		this.mappedArgs = [];
		this.errorHandler = new ErrorHandler(fn);
		this.errorHandler.update(FunctionErrors.ifNot(sheet, ERROR.ARGS));
	}

	ignoreError() {
		this.errorHandler.ignoreError = true;
		return this;
	}

	onSheetCalculation() {
		this.isEnabled = !this.errorHandler.hasError() && this.sheet.isProcessing;
		return this;
	}

	withArgCount(nr) {
		this.errorHandler.update(FunctionErrors.ifTrue(this.args.length !== nr, ERROR.ARGS));
		return this;
	}

	withMinArgs(min) {
		this.errorHandler.update(FunctionErrors.ifTrue(this.args.length < min, ERROR.ARGS));
		return this;
	}

	withMaxArgs(max) {
		this.errorHandler.update(FunctionErrors.ifTrue(this.args.length > max, ERROR.ARGS));
		return this;
	}

	// adds additional value which is passed to run(), eg: addMappedArg(() => sheet.streamsheet || ERROR.NO_STREAMSHEET)
	addMappedArg(fn) { // REVIEW!
		if (!this.errorHandler.hasError()) {
			const res = fn(...this.mappedArgs);
			this.errorHandler.update(res);
			this.mappedArgs.push(res);
		}
		return this;
	}

	mapNextArg(fn) {
		if (!this.errorHandler.hasError()) {
			const term = this.args.shift();
			const res = fn(term, ...this.mappedArgs);
			this.errorHandler.update(res, this.index);
			this.mappedArgs.push(res);
			this.index += 1;
			this.prevArg = term;
		}
		return this;
	}

	// review: actually not necessary since it can be done on mapNextArg()!
	remapPrevArg(fn) {
		if (!this.errorHandler.hasError()) {
			const term = this.prevArg;
			if (term) {
				const idx = this.index - 1;
				const lastRes = this.mappedArgs.pop();
				const res = fn(term, lastRes, ...this.mappedArgs);
				this.errorHandler.update(res, idx);
				this.mappedArgs.push(res);
			}
		}
		return this;
	}
	// under review:
	mapArgAt(idx, fn) {
		if (!this.errorHandler.hasError()) {
			const term = remove(idx, this.args);
			const res = fn(term, ...this.mappedArgs);
			this.errorHandler.update(res, idx);
			this.mappedArgs.push(res);
			this.index = idx;
		}
		return this;
	}
	mapRemaingingArgs(fn) {
		if (!this.errorHandler.hasError()) {
			const res = fn(this.args, ...this.mappedArgs);
			this.errorHandler.update(res);
			this.mappedArgs.push(res);
		}
		return this;
	}

	reduce(fn) {
		if (!this.errorHandler.hasError()) {
			const res = fn(...this.mappedArgs);
			this.errorHandler.update(res);
			this.mappedArgs = res;
		}
		return this;
	}

	// remove! better use beforeRun()
	validate(fn) {
		if (!this.errorHandler.hasError()) {
			this.errorHandler.update(fn(...this.mappedArgs));
		}
		return this;
	}
	// under review: name alternatives: apply, prepare, invoke, beforeRun
	beforeRun(fn) {
		if (!this.errorHandler.hasError()) {
			this.errorHandler.update(fn(...this.mappedArgs));
		}
		return this;
	}

	// tmp. => review and maybe combine with onSheetCalculation
	defaultReturnValue(fn) {
		this.defReturnValue = fn(...this.mappedArgs);
		this.defReturnValue = this.defReturnValue != null ? this.defReturnValue : true;
		return this;
	}

	run(fn) {
		const error = this.errorHandler.getError();
		if (error && !this.errorHandler.ignoreError) {
			return this.setFunctionName(error);
			// setErrorInfo(this.cell, error);
			// return error;
		}
		if (this.isEnabled) {
			const res = fn(...this.mappedArgs, error);
			// fn returns an error?
			// if (FunctionErrors.isError(res)) setErrorInfo(this.cell, ErrorInfo.create(res));
			if (FunctionErrors.isError(res) && res.isErrorInfo) return this.setFunctionName(res);
			return res;
		}
		return this.defReturnValue;
		// if (this.errorHandler.hasError()) {
		// 	return this.errorHandler.getError().code;
		// }
		// return this.isEnabled ? fn(...this.mappedArgs, error) : this.defReturnValue;
	}
}


module.exports = (sheet, terms, fn) => new Runner(sheet, terms, fn);
