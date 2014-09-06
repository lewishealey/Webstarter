<?php
/**
 * The base configurations of the WordPress.
 *
 * This file has the following configurations: MySQL settings, Table Prefix,
 * Secret Keys, WordPress Language, and ABSPATH. You can find more information
 * by visiting {@link http://codex.wordpress.org/Editing_wp-config.php Editing
 * wp-config.php} Codex page. You can get the MySQL settings from your web host.
 *
 * This file is used by the wp-config.php creation script during the
 * installation. You don't have to use the web site, you can just copy this file
 * to "wp-config.php" and fill in the values.
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'blank');

/** MySQL database username */
define('DB_USER', 'root');

/** MySQL database password */
define('DB_PASSWORD', 'root');

/** MySQL hostname */
define('DB_HOST', 'localhost');

/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8');

/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',         'SLJUA?1@whuiFfU-l_3z/)9fMkx9!VqJ}8Irq;AVvJ$<OrnGvZG]O^GLykQ=VW7}');
define('SECURE_AUTH_KEY',  'rp5M$oxq?2ypolwyHe[jcM;5iAp$B8-5vz)>tw#@22P2+u!)Qabs8P21KVIgp~~T');
define('LOGGED_IN_KEY',    '6e*j|<&u@m,u5`,emmI`x@2{`.SF?Dx o(tXq~q2t|CcO(&TC*<G1ffls#c6g{]3');
define('NONCE_KEY',        '^rZhE5$aC0xTv@wRjh$i:]=~G4Ex0Q-v|?W.L5;c `/||{vDniN3|lkdkl,9r.te');
define('AUTH_SALT',        '*ew$lQ.85![VwaZ)nvB]fOrU00R(FK-}T 7PHS:6N-jl/rSV~}sI6QG%iKG,0 3(');
define('SECURE_AUTH_SALT', 'MR37R2X)U,Zrc}-o>]]|nHJhXe;pp/91A+6b8=--ze0v[}rOX1GPsdlU)0{g3ENy');
define('LOGGED_IN_SALT',   'wy_e9vUD9+~rujn%*OEjF&}l8e|HTnIV$NsZYdzJJ+@h2rVdqzD3)Q|h.D)D>&qp');
define('NONCE_SALT',       'z_+s-y5Py(cdv!=&/[K5ksESMf[mKi|[0H9iZ=k#{L#[W|J|D]r}RPdc66N7ysC<');

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each a unique
 * prefix. Only numbers, letters, and underscores please!
 */
$table_prefix  = 'wp_';

/**
 * WordPress Localized Language, defaults to English.
 *
 * Change this to localize WordPress. A corresponding MO file for the chosen
 * language must be installed to wp-content/languages. For example, install
 * de_DE.mo to wp-content/languages and set WPLANG to 'de_DE' to enable German
 * language support.
 */
define('WPLANG', '');

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 */
define('WP_DEBUG', false);

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
	define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');
