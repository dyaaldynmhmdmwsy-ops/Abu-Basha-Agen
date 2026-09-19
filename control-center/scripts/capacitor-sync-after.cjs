const fs = require('fs');

const files = {
  settings: 'android/settings.gradle',
  appBuild: 'android/app/build.gradle',
  capacitorBuild: 'android/app/capacitor.build.gradle',
  cordovaBuild: 'android/capacitor-cordova-android-plugins/build.gradle',
};

function removeExact(file, text) {
  const original = fs.readFileSync(file, 'utf8');
  const updated = original.split(text).join('');
  if (updated !== original) {
    fs.writeFileSync(file, updated);
  }
}

removeExact(
  files.settings,
  "include ':capacitor-cordova-android-plugins'\n"
);

removeExact(
  files.settings,
  "project(':capacitor-cordova-android-plugins').projectDir = new File('./capacitor-cordova-android-plugins/')\n"
);

removeExact(
  files.appBuild,
  "    implementation project(':capacitor-cordova-android-plugins')\n"
);

removeExact(
  files.capacitorBuild,
  'apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"\n'
);

if (fs.existsSync(files.cordovaBuild)) {
  removeExact(
    files.cordovaBuild,
    "    flatDir{\n        dirs 'src/main/libs', 'libs'\n    }\n"
  );
}

console.log('ABU_BASHA_CORDOVA_POST_SYNC=PASS');
