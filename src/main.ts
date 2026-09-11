/*
 * Ulaz aplikacije: prava platforma (browser), stilovi, statički skelet stranice, pa boot.
 */
import './ui/fonts.css'
import './ui/styles.css'
import { napraviPlatformu } from './platform'
import { createApp } from './ui/app'
import { montirajSkelet } from './ui/skelet'

const platforma = napraviPlatformu()
montirajSkelet(document)
void createApp(document, platforma).boot()
