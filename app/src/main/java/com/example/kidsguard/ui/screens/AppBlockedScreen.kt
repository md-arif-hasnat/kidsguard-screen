package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AppBlockedScreen(
    packageName: String?,
    reason: String?,
    onBackToHome: () -> Unit,
    onRequestAccess: (String, String) -> Unit
) {
    val isLimit = reason == "LIMIT_REACHED"
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                imageVector = if (isLimit) Icons.Default.Timer else Icons.Default.Block,
                contentDescription = null,
                tint = if (isLimit) Color.Yellow else Color.Red,
                modifier = Modifier.size(100.dp)
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = if (isLimit) "DAILY LIMIT REACHED" else "APP BLOCKED",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = if (isLimit) 
                    "You have reached your daily time limit for this application." 
                    else "This application has been blocked by your parent.",
                color = Color.Gray,
                textAlign = TextAlign.Center,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            
            if (packageName != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = packageName,
                    color = Color.DarkGray,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
            
            Spacer(modifier = Modifier.height(48.dp))
            
            Button(
                onClick = onBackToHome,
                colors = ButtonDefaults.buttonColors(containerColor = if (isLimit) Color.DarkGray else Color.Red),
                shape = MaterialTheme.shapes.large,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Text(
                    text = "GO HOME",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = { packageName?.let { onRequestAccess(it, reason ?: "BLOCKED") } },
                shape = MaterialTheme.shapes.large,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.Gray),
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Text(
                    text = if (isLimit) "REQUEST MORE TIME" else "REQUEST ACCESS",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
    }
}
