var artillery = {
  base: 3,
  incr: 2,
  demage: [0,
    700, 777, 862, 957, 1063,
    1180, 1309, 1453, 1613, 1791,
    1988, 2206, 2499, 2718, 3017,
    3349, 3718, 4127, 4580, 5084
  ]
};

var barrage = {
  base: 10,
  incr: 6,
  demage: [0,
    2850, 3135, 3450, 3795, 4170,
    4590, 5055, 5550, 6105, 6720,
    7395, 8130, 8940, 9840, 10830,
    11910
  ]
};

function calculateEnergyRequiered(shots, base, incr) {
  return shots * base + (shots-1) * shots * incr / 2;
}

function determineBestStrategy(energy, artilleryLevel, barrageLevel) {
  var artilleryDamage = artillery.demage[artilleryLevel];
  var barrageDamage = barrage.demage[barrageLevel];
  var configures = [];
  for (var artilleryShots = 0; artilleryShots < 10; artilleryShots++)
  for (var barrageShots = 0; barrageShots < 10; barrageShots++) {
    var energyRequiered =
        calculateEnergyRequiered(artilleryShots, artillery.base, artillery.incr) +
        calculateEnergyRequiered(barrageShots, barrage.base, barrage.incr);
    if (energyRequiered > energy)
      break;
    var damageMade =
          artilleryDamage * artilleryShots +
          barrageDamage * barrageShots;
    configures.push({
      energyRequiered: energyRequiered,
      artilleryShots: artilleryShots,
      barrageShots: barrageShots,
      damageMade: damageMade,
      efficiency: damageMade / energyRequiered
    });
  }
  configures.sort(function(lhc, rhc) {
    return (rhc.damageMade - lhc.damageMade) ||
        (lhc.energyRequiered - rhc.energyRequiered);
  });
  var maxDamageMade = configures[0].damageMade;
  var numberOfConfigs = 0;
  for (; numberOfConfigs < configures.length; numberOfConfigs++) {
    var damageMade = configures[numberOfConfigs].damageMade;
    if ((maxDamageMade - damageMade) / maxDamageMade > 0.2)
      break;
  }
  configures.length = numberOfConfigs + 1;
  configures.sort(function(lhc, rhc) {
    return rhc.efficiency - lhc.efficiency;
  });
  return configures;
}

var argv = process.argv;
console.log(determineBestStrategy(+argv[2], +argv[3], +argv[4]));
