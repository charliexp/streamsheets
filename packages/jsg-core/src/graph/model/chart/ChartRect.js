

module.exports = class ChartRect {
	constructor(left, top, right, bottom) {
		this.set(left, top, right, bottom);
	}

	reset() {
		this.left = 0;
		this.right = 0;
		this.top = 0;
		this.bottom = 0;
	}

	copy() {
		return new ChartRect(this.left, this.top, this.right, this.bottom);
	}

	sort() {
		if (this.left > this.right) {
			const x = this.right;
			this.right = this.left;
			this.left = x;
		}
		if (this.top > this.bottom) {
			const y = this.bottom;
			this.bottom = this.top;
			this.top = y;
		}
	}

	get points() {
		return [
			{x: this.left, y: this.top},
			{x: this.right, y: this.top},
			{x: this.right, y: this.bottom},
			{x: this.left, y: this.bottom},
		];
	}

	containsPoint(pt) {
		return pt.x >= this.left && pt.x <= this.right && pt.y >= this.top && pt.y <= this.bottom;
	}

	set(left, top, right, bottom) {
		this.left = left || 0;
		this.top = top || 0;
		this.right = right || 0;
		this.bottom = bottom || 0;
	}

	get width() {
		return this.right - this.left;
	}

	get height() {
		return this.bottom - this.top;
	}

	toString() {
		return `${this.left} ${this.top} ${this.right} ${this.bottom}`;
	}

	static fromString(str) {
		const rect = new ChartRect(0, 0, 0, 0);
		if (str !== undefined) {
			const parts = str.split(' ');
			if (parts.length === 4) {
				rect.left = Number(parts[0]);
				rect.top = Number(parts[1]);
				rect.right = Number(parts[2]);
				rect.bottom = Number(parts[3]);
			}
		}

		return rect;
	}
};

