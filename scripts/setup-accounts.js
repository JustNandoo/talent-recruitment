import { loadEnvironment, readConfig } from '../lib/config.js';
import { openStore } from '../lib/store.js';
import { prepareAccounts } from '../lib/accounts.js';
loadEnvironment();
const config = readConfig(), store = openStore(config.dataDir);
try {
  const result = prepareAccounts(store, config);
  console.log(result.created ? 'Akun superadmin dan admin dibuat. Buka .data/initial-accounts.txt secara pribadi; ganti kata sandi awal saat masuk.' : 'Akun sudah ada. Tidak ada akun atau kata sandi yang ditimpa. Gunakan menu Akun penguji pada superadmin.');
} finally { store.close(); }
