
function loadImages(imageFiles, callback) {
    const images = {};

    let remaining = imageFiles.length;
    const progress = () => {
        remaining--;
        if (remaining === 0) {
            callback(null, images);
        }
    };

    imageFiles.forEach((imageFile) => {
        images[imageFile] = new Image();
        images[imageFile].onload = progress;
        images[imageFile].src = imageFile;
    });
}

function loadSounds(soundFiles, callback) {
    const sounds = {};

    soundFiles.forEach((soundFile) => {
        sounds[soundFile] = new Audio();
        sounds[soundFile].src = soundFile;
    });

    callback(null, sounds);
}

function getMouseXPos(ctx, evt) {
    const rect = ctx.getBoundingClientRect();
    return evt.clientX - rect.left;
}

class Sprite {
    constructor(image, x, y) {
        this.image = image;
        this.x = x;
        this.y = y;
    }

    collidesWith(that) {
        return (this.x < that.x + that.w) &&
                (this.x + this.w > that.x) &&
                (this.y < that.y + that.h) &&
                (this.y + this.h > that.y);
    }
    leaving(that) {
        return this.x < that.x || this.y < that.y || this.x + this.w > that.x + that.w || this.y + this.h > that.y + that.h;
    }
    get w() {
        return this.image.width;
    }
    get h() {
        return this.image.height;
    }
    get xcent() {
        return this.x + (this.w/2);
    }
    get ycent() {
        return this.y + (this.h/2);
    }
}

class Heart extends Sprite {
    constructor(images, x, y) {
        super(images[1], x, y);
        this.images = images; // 0=EMPTY, 1=FULL
    }

    get full() {
        return this.images[1] == this.image;
    }

    get empty() {
        return !this.full;
    }

    set empty(value) {
        this.image = this.images[value === true ? 0 : 1];
    }

    set full(value) {
        this.empty = !value;
    }

}

class HorizontalTile extends Sprite {
    constructor(sound, image, x, y, fullWidth) {
        super(image, x, y);
        this.fullWidth = fullWidth;
        this.sound = sound;
    }
    get w() {
        return this.fullWidth;
    }
}

class Background extends Sprite {
    constructor(image, x, y) {
        super(image, x, y);
    }
}

class Tosser extends Sprite {
    constructor(image, x, y, facing) {
        super(image, x, y);
        this.facing = facing;
    }
    setX(xpos) {
        if (xpos > lucinda.x) {
            this.facing = 'right';
        } else if (xpos < this.x) {
            this.facing = 'left';
        }

        if (xpos < this.w) {
            this.x = 0;
        } else if (xpos > canvas.width - this.w) {
            this.x = canvas.width - this.w;
        } else {
            this.x = xpos;
        }
    }
}

class Twinsie extends Sprite {
    constructor(sound, image, x, y, dx, dy) {
        super(image, x, y);
        this.sound = sound;
        this.dx = dx;
        this.dy = dy;
        this.r = 0;
        this.dr = 0.031415926535;
    }
    move() {

        this.x = (this.x + this.dx) % canvas.width;
        this.y = (this.y + this.dy) % canvas.height;
        this.r = (this.r + this.dr) % (2 * Math.PI);
    }
}

let lucinda;
let lydia;
let bennett;
let ground;
let scene;
let healthbar;
let hp;
let digits;
let score;

let canvas;
let ctx;
let aud;

let paused = true;

function game_over() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillText("Game Over", canvas.width/2, 190); 
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save(); // background
    ctx.drawImage(scene.image, scene.x, scene.y, scene.w, scene.h);
    ctx.restore();

    ctx.save(); // health bar
    healthbar.forEach((heart) => ctx.drawImage(heart.image, heart.x, heart.y, heart.w, heart.h));
    ctx.restore();

    ctx.save(); // scoreboard
    `${score}`.padStart(8, '0').split('').map((digit) => digits[parseInt(digit)]).forEach((img, index) => {
        ctx.drawImage(img, 10 * index + 6, 6, img.width + 2, img.height + 2);
    });
    ctx.restore();

    ctx.save();
    var groundPattern = ctx.createPattern(ground.image, 'repeat');
    ctx.fillStyle = groundPattern;
    ctx.fillRect(ground.x, ground.y, canvas.width, ground.image.height);
    ctx.restore();

    [ lydia, bennett ].forEach((twinsie) => {

        const toss = twinsie.collidesWith(lucinda);
        if (toss) {
            twinsie.sound.play();

            // hits on right side of lucinda send twinsies to the right
            // hits on the left side of lucinda send twinsies to the left
            twinsie.dx = Math.abs(twinsie.dx) * ((lucinda.x > twinsie.x) ? -1 : 1);

            // ensure any collision results in the twinsie be sent upward from above lucinda
            twinsie.y = lucinda.y - (lucinda.h/2) - 1;
            twinsie.dy *= -1;

            // award a point
            score++;

        } else if (twinsie.collidesWith(ground)) {
            ground.sound.play();
            hp--;

            // refill healthbar.
            healthbar.forEach((heart, i) => {
                if (i < hp) {
                    heart.full = true;
                } else {
                    heart.empty = true;
                }
            });

            twinsie.dy *= -1;
        } else if (twinsie.leaving(scene)) {
            if (twinsie.y <= 0) {   // sky
                twinsie.dy *= -1;
            } else {                // wall
                twinsie.dx *= -1;
                twinsie.x = (twinsie.x - twinsie.w <= 0) ? 1 : canvas.width - twinsie.w - 1;
            }
        }
        twinsie.move(); // update x,y positions

        ctx.save();

        // add spin effect
        ctx.translate(twinsie.xcent, twinsie.ycent);
        ctx.rotate(twinsie.r); 
        ctx.translate(-twinsie.xcent, -twinsie.ycent);

        ctx.drawImage(twinsie.image, twinsie.x, twinsie.y, twinsie.w, twinsie.h);
        ctx.restore();
    });

    ctx.save();
    if (lucinda.facing === 'left') {
        ctx.translate(lucinda.image.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(lucinda.image, -lucinda.x, lucinda.y, lucinda.w, lucinda.h);
    } else {
        ctx.drawImage(lucinda.image, lucinda.x, lucinda.y, lucinda.w, lucinda.h);
    }
    ctx.restore();

    // is game over?
    if (healthbar.every((heart) => heart.empty)) {
        window.requestAnimationFrame(game_over);
    } else if (!paused) {
        window.requestAnimationFrame(draw);
    }
}

function init() {
    const SCENE = 'img/scene.png';
    const GROUND = 'img/ground.png';
    const LYDIA = 'img/lydia.png';
    const BENNETT = 'img/bennett.png';
    const LUCINDA = 'img/lucinda.png';
    const HEART_EMPTY = 'img/heart-empty.png';
    const HEART_FULL = 'img/heart-full.png';

    const DIGIT_0 = 'img/0.png';
    const DIGIT_1 = 'img/1.png';
    const DIGIT_2 = 'img/2.png';
    const DIGIT_3 = 'img/3.png';
    const DIGIT_4 = 'img/4.png';
    const DIGIT_5 = 'img/5.png';
    const DIGIT_6 = 'img/6.png';
    const DIGIT_7 = 'img/7.png';
    const DIGIT_8 = 'img/8.png';
    const DIGIT_9 = 'img/9.png';

    const HIT1 = 'snd/hit1.ogg';
    const HIT2 = 'snd/hit2.ogg';
    const SPLAT = 'snd/splat.ogg';

    canvas = document.getElementById("twinsie-toss");
    ctx = canvas.getContext("2d");

    loadSounds([
        HIT1,
        HIT2,
        SPLAT,
    ], (err, sounds) => {
        if (err) {
            return;
        }

        loadImages([
            SCENE,
            GROUND,
            LYDIA,
            BENNETT,
            LUCINDA,
            HEART_EMPTY,
            HEART_FULL,
            DIGIT_0,
            DIGIT_1,
            DIGIT_2,
            DIGIT_3,
            DIGIT_4,
            DIGIT_5,
            DIGIT_6,
            DIGIT_7,
            DIGIT_8,
            DIGIT_9,
        ], (err, images) => {
            if (err) {
                return;
            }

            // fill canvas
            scene = new Background(images[SCENE], 0, 0);

            // snap to bottom of canvas
            ground = new HorizontalTile(sounds[SPLAT], images[GROUND], 0, canvas.height - images[GROUND].height, canvas.width);

            // center of canvas above the ground, follow mouse
            lucinda = new Tosser(images[LUCINDA],  canvas.width / 2, canvas.height - images[LUCINDA].height - images[GROUND].height, 'right');
            canvas.addEventListener('mousemove', (evt) => lucinda.setX(getMouseXPos(canvas, evt) - (lucinda.w / 2)));
            canvas.addEventListener('click', (evt) => {
                paused = !paused;
                if (!paused) {
                    draw();
                }
            });

            document.addEventListener("keydown", (evt) => {
                switch (evt.key) {
                    case ' ':
                        paused = !paused;
                        if (!paused) {
                            draw();
                        }
                        break;
                }
            });

            // flying through the air
            lydia = new Twinsie(sounds[HIT1], images[LYDIA], 100, 100, Math.PI * Math.random() + 2, 3);
            bennett = new Twinsie(sounds[HIT2], images[BENNETT], 200, 300, Math.PI * Math.random() + 2, 4);

            // health bar
            healthbar = [
                new Heart([ images[HEART_EMPTY], images[HEART_FULL ] ], canvas.width - 21, 6),
                new Heart([ images[HEART_EMPTY], images[HEART_FULL ] ], canvas.width - 42, 6),
                new Heart([ images[HEART_EMPTY], images[HEART_FULL ] ], canvas.width - 63, 6),
            ];
            hp = healthbar.length;

            // digits for scoreboard
            digits = [
                images[DIGIT_0],
                images[DIGIT_1],
                images[DIGIT_2],
                images[DIGIT_3],
                images[DIGIT_4],
                images[DIGIT_5],
                images[DIGIT_6],
                images[DIGIT_7],
                images[DIGIT_8],
                images[DIGIT_9],
            ];
            score = 0;

            // start screen

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.drawImage(scene.image, scene.x, scene.y, scene.w, scene.h);
            ctx.restore();

            ctx.save();
            var groundPattern = ctx.createPattern(ground.image, 'repeat');
            ctx.fillStyle = groundPattern;
            ctx.fillRect(ground.x, ground.y, canvas.width, ground.image.height);
            ctx.restore();


            ctx.save();
            ctx.font = "24px Comic Sans MS";
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.fillText("Click to Start", canvas.width/2, 190); 
            ctx.restore();

        });
    });
    
}

window.onload = init;
