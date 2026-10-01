import { registerRootComponent } from 'expo';
// Фоновая задача для кнопки «✓ Выпила» должна объявляться сразу при загрузке
import './src/logic/notify';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
