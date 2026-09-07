package com.petdocs.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.petdocs.android.ui.nav.PetdocsNav
import com.petdocs.android.ui.theme.PetdocsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PetdocsTheme {
                PetdocsNav()
            }
        }
    }
}
